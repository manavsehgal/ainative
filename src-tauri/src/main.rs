use std::{
    fs,
    net::{TcpListener, TcpStream},
    path::PathBuf,
    process::{Child, Command},
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

fn main() {
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

            let child = Command::new(resolve_node_bin())
                .arg(&cli_path)
                .arg("--no-open")
                .arg("--port")
                .arg(requested_port.to_string())
                .current_dir(&app_root)
                .env("STAGENT_DATA_DIR", &data_dir)
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
    std::env::var("STAGENT_DESKTOP_NODE_BIN").unwrap_or_else(|_| "node".to_string())
}

fn ensure_data_dir(app: &tauri::App) -> Result<String, Box<dyn std::error::Error>> {
    let data_dir = app.path().app_data_dir()?;
    fs::create_dir_all(&data_dir)?;
    Ok(data_dir.to_string_lossy().into_owned())
}

fn resolve_app_root(app: &tauri::App) -> Result<PathBuf, Box<dyn std::error::Error>> {
    if let Ok(resource_dir) = app.path().resource_dir() {
        let bundled_cli = resource_dir.join("dist").join("cli.js");
        if bundled_cli.exists() {
            return Ok(resource_dir);
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
