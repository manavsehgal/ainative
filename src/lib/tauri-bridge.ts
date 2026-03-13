type TauriDialogFilter = {
  name: string;
  extensions: string[];
};

type TauriDialogOptions = {
  directory?: boolean;
  multiple?: boolean;
  filters?: TauriDialogFilter[];
};

type TauriNotificationPayload = {
  title: string;
  body?: string;
};

type TauriNotificationApi = {
  isPermissionGranted?: () => Promise<boolean>;
  requestPermission?: () => Promise<boolean | "granted" | "denied" | "default">;
  sendNotification?: (
    payload: string | TauriNotificationPayload
  ) => Promise<void> | void;
};

type TauriDialogApi = {
  open?: (options?: TauriDialogOptions) => Promise<unknown>;
};

declare global {
  interface Window {
    __TAURI__?: {
      dialog?: TauriDialogApi;
      notification?: TauriNotificationApi;
    };
  }
}

function getTauriApi() {
  if (typeof window === "undefined") return null;
  return window.__TAURI__ ?? null;
}

export const isTauri = () => Boolean(getTauriApi());

export async function showNativeNotification(
  title: string,
  body?: string
): Promise<boolean> {
  const tauriApi = getTauriApi();

  if (tauriApi?.notification?.sendNotification) {
    const permissionCheck = tauriApi.notification.isPermissionGranted;
    const requestPermission = tauriApi.notification.requestPermission;

    let granted = true;
    if (permissionCheck) {
      granted = await permissionCheck();
    }

    if (!granted && requestPermission) {
      const result = await requestPermission();
      granted = result === true || result === "granted";
    }

    if (granted) {
      await tauriApi.notification.sendNotification({ title, body });
      return true;
    }

    return false;
  }

  if (typeof window === "undefined" || typeof Notification === "undefined") {
    return false;
  }

  if (Notification.permission === "granted") {
    new Notification(title, body ? { body } : undefined);
    return true;
  }

  if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      new Notification(title, body ? { body } : undefined);
      return true;
    }
  }

  return false;
}

export async function selectFile(options?: TauriDialogOptions): Promise<
  string | string[] | null
> {
  const tauriApi = getTauriApi();

  if (tauriApi?.dialog?.open) {
    const result = await tauriApi.dialog.open(options);
    if (Array.isArray(result)) {
      return result.filter((value): value is string => typeof value === "string");
    }
    return typeof result === "string" ? result : null;
  }

  if (typeof window === "undefined" || options?.directory) {
    return null;
  }

  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = Boolean(options?.multiple);

    if (options?.filters?.length) {
      input.accept = options.filters
        .flatMap((filter) => filter.extensions.map((extension) => `.${extension}`))
        .join(",");
    }

    input.addEventListener(
      "change",
      () => {
        const files = input.files;
        if (!files || files.length === 0) {
          resolve(null);
          return;
        }

        const names = Array.from(files, (file) => file.name);
        resolve(options?.multiple ? names : names[0] ?? null);
      },
      { once: true }
    );

    input.click();
  });
}
