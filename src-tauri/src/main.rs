use std::{
    fs::{self, File},
    net::{TcpListener, TcpStream},
    path::PathBuf,
    process::{Child, Command, Stdio},
    sync::Mutex,
    thread,
    time::{Duration, Instant},
};

use tauri::{AppHandle, Manager, RunEvent};

struct SidecarState {
    child: Mutex<Option<Child>>,
}

impl Default for SidecarState {
    fn default() -> Self {
        Self {
            child: Mutex::new(None),
        }
    }
}

fn setup_crash_log() {
    use std::io::Write;
    let log_path = PathBuf::from("/tmp/stagent-crash.log");
    let _ = fs::remove_file(&log_path);

    std::panic::set_hook(Box::new(move |info| {
        let message = format!("PANIC: {}\nLocation: {:?}\n---\n", info, info.location());
        if let Ok(mut f) = fs::OpenOptions::new().create(true).append(true).open(&log_path) {
            let _ = f.write_all(message.as_bytes());
        }
        eprintln!("{message}");
    }));
}

fn main() {
    setup_crash_log();

    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .manage(SidecarState::default())
        .setup(|app| {
            let requested_port = find_available_port(3210)
                .ok_or_else(|| io_error("failed to reserve a local port for the desktop sidecar"))?;
            let app_root = resolve_app_root(app)?;
            let cli_path = app_root.join("dist").join("cli.js");

            if !cli_path.exists() {
                return Err(io_error(format!(
                    "desktop sidecar entry is missing: {}",
                    cli_path.display()
                )));
            }

            let data_dir = ensure_data_dir(app)?;
            let server_url = format!("http://127.0.0.1:{requested_port}");
            let wait_window = app
                .get_webview_window("main")
                .ok_or_else(|| io_error("desktop main window is not configured"))?;

            boot_set_status(
                &wait_window,
                "Reserving workspace channel",
                &format!("Allocated localhost port {requested_port} for the desktop sidecar."),
            );

            let sidecar_log_path = PathBuf::from("/tmp/stagent-sidecar.log");
            let log_file = File::create(&sidecar_log_path)
                .map_err(|e| io_error(format!("failed to create sidecar log: {e}")))?;
            let stderr_file = log_file.try_clone()
                .map_err(|e| io_error(format!("failed to clone sidecar log handle: {e}")))?;

            let node_bin = resolve_node_bin();

            // The CLI spawns `node_modules/.bin/next` which is a shell shim
            // using `#!/usr/bin/env node`. Finder-launched GUI apps have a
            // minimal PATH that won't include node, so prepend its directory.
            let node_dir = PathBuf::from(&node_bin)
                .parent()
                .unwrap_or_else(|| std::path::Path::new("/usr/local/bin"))
                .to_path_buf();
            let enriched_path = format!(
                "{}:{}",
                node_dir.display(),
                std::env::var("PATH").unwrap_or_default()
            );

            let child = Command::new(&node_bin)
                .arg(&cli_path)
                .arg("--no-open")
                .arg("--port")
                .arg(requested_port.to_string())
                .current_dir(&app_root)
                .env("STAGENT_DATA_DIR", &data_dir)
                .env("PATH", &enriched_path)
                .stdout(Stdio::from(log_file))
                .stderr(Stdio::from(stderr_file))
                .spawn()
                .map_err(|error| io_error(format!("failed to start Stagent desktop sidecar: {error}")))?;

            let child_id = child.id();
            {
                let state = app.state::<SidecarState>();
                *state.child.lock().unwrap() = Some(child);
            }

            boot_set_status(
                &wait_window,
                "Launching desktop sidecar",
                &format!("Starting local Stagent sidecar on {server_url} (pid {child_id})."),
            );

            let ready_window = wait_window.clone();
            let ready_server_url = server_url.clone();
            tauri::async_runtime::spawn(async move {
                if wait_for_server(requested_port, Duration::from_secs(90)) {
                    boot_mark_ready(
                        &ready_window,
                        &ready_server_url,
                        "Workspace interface ready",
                        &format!(
                            "The live workspace answered on {ready_server_url}. Holding for a smooth desktop handoff."
                        ),
                    );
                } else {
                    boot_mark_error(
                        &ready_window,
                        "Launch timeout",
                        "Desktop sidecar did not answer on localhost within 90 seconds.",
                    );
                }
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            if matches!(event, tauri::WindowEvent::CloseRequested { .. }) {
                kill_sidecar(window.app_handle());
            }
        });

    let app = builder
        .build(tauri::generate_context!())
        .expect("error building Stagent desktop shell");

    app.run(|handle, event| {
        if matches!(event, RunEvent::Exit | RunEvent::ExitRequested { .. }) {
            kill_sidecar(handle);
        }
    });
}

fn resolve_node_bin() -> String {
    if let Ok(bin) = std::env::var("STAGENT_DESKTOP_NODE_BIN") {
        return bin;
    }

    // macOS GUI apps launched via Finder get a minimal PATH (/usr/bin:/bin:/usr/sbin:/sbin).
    // Node installed via Homebrew, nvm, fnm, Volta, or the official pkg installer won't be
    // on that PATH. Probe common locations so the sidecar can start without requiring the
    // user to set an env var.
    let candidates = [
        "/usr/local/bin/node",           // Homebrew (Intel) / official pkg
        "/opt/homebrew/bin/node",        // Homebrew (Apple Silicon)
        "/usr/bin/node",                 // system / distro package
    ];

    // Also check nvm/fnm/volta in the user's home directory.
    let home_candidates: Vec<PathBuf> = if let Ok(home) = std::env::var("HOME") {
        vec![
            PathBuf::from(&home).join(".nvm/current/bin/node"),
            PathBuf::from(&home).join(".local/share/fnm/aliases/default/bin/node"),
            PathBuf::from(&home).join(".volta/bin/node"),
        ]
    } else {
        vec![]
    };

    for candidate in candidates.iter().map(PathBuf::from).chain(home_candidates) {
        if candidate.exists() {
            return candidate.to_string_lossy().into_owned();
        }
    }

    // Last resort: hope it's on PATH (works from terminal, not from Finder).
    "node".to_string()
}

fn ensure_data_dir(app: &tauri::App) -> Result<String, Box<dyn std::error::Error>> {
    let data_dir = app.path().app_data_dir()?;
    fs::create_dir_all(&data_dir)?;
    Ok(data_dir.to_string_lossy().into_owned())
}

fn resolve_app_root(app: &tauri::App) -> Result<PathBuf, Box<dyn std::error::Error>> {
    if let Ok(resource_dir) = app.path().resource_dir() {
        // Tauri v2 rewrites "../" resource prefixes to "_up_/" inside the bundle.
        // Our tauri.conf.json resources use "../dist", "../node_modules", etc.,
        // so the actual project files land under <Resources>/_up_/.
        for candidate in &[
            resource_dir.join("_up_"),
            resource_dir.clone(),
        ] {
            if candidate.join("dist").join("cli.js").exists() {
                return Ok(candidate.clone());
            }
        }
    }

    let repo_root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .ok_or_else(|| io_error("failed to resolve repo root from src-tauri"))?
        .to_path_buf();

    Ok(repo_root)
}

fn find_available_port(start: u16) -> Option<u16> {
    (start..=start.saturating_add(200)).find(|port| TcpListener::bind(("127.0.0.1", *port)).is_ok())
}

fn wait_for_server(port: u16, timeout: Duration) -> bool {
    let deadline = Instant::now() + timeout;

    while Instant::now() < deadline {
        if TcpStream::connect(("127.0.0.1", port)).is_ok() {
            return true;
        }

        thread::sleep(Duration::from_millis(500));
    }

    false
}

fn kill_sidecar(app: &AppHandle) {
    let state = app.state::<SidecarState>();
    let mut child = state.child.lock().unwrap();

    if let Some(mut child_process) = child.take() {
        let _ = child_process.kill();
        let _ = child_process.wait();
    }
}

fn boot_set_status(window: &tauri::WebviewWindow, phase: &str, message: &str) {
    let _ = window.eval(&format!(
        "window.__STAGENT_BOOT__?.setStatus({phase:?}, {message:?});"
    ));
}

fn boot_mark_ready(window: &tauri::WebviewWindow, url: &str, phase: &str, message: &str) {
    let _ = window.eval(&format!(
        "window.__STAGENT_BOOT__?.markReady({url:?}, {phase:?}, {message:?});"
    ));
}

fn boot_mark_error(window: &tauri::WebviewWindow, phase: &str, message: &str) {
    let _ = window.eval(&format!(
        "window.__STAGENT_BOOT__?.markError({phase:?}, {message:?});"
    ));
}

fn io_error(message: impl Into<String>) -> Box<dyn std::error::Error> {
    Box::new(std::io::Error::other(message.into()))
}
