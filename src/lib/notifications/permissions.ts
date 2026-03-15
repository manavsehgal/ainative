export type PermissionToolInput = Record<string, unknown>;

function truncate(value: string, max = 120): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

function toDisplayString(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

export function parseNotificationToolInput(
  toolInput: string | null
): PermissionToolInput | null {
  if (!toolInput) return null;

  try {
    const parsed = JSON.parse(toolInput);
    return parsed && typeof parsed === "object"
      ? (parsed as PermissionToolInput)
      : null;
  } catch (err) {
    console.error("[permissions] Failed to parse notification tool input:", err);
    return null;
  }
}

export function getPermissionKindLabel(toolName: string | null): string {
  if (!toolName) return "Tool";

  if (toolName.startsWith("mcp__")) {
    const [, server = "server", tool = "tool"] = toolName.split("__");
    return `MCP ${server}/${tool}`;
  }

  return toolName;
}

export function buildPermissionPattern(
  toolName: string,
  input: PermissionToolInput
): string {
  if (toolName === "Bash" && typeof input.command === "string") {
    const firstWord = input.command.trim().split(/\s+/)[0];
    return `Bash(command:${firstWord} *)`;
  }

  if (toolName === "bash" && typeof input.cmd === "string") {
    const firstWord = input.cmd.trim().split(/\s+/)[0];
    return `bash(command:${firstWord} *)`;
  }

  return toolName;
}

export function buildPermissionSummary(
  toolName: string | null,
  input: PermissionToolInput | null
): string {
  if (!input) return "Review the requested tool invocation.";

  if (toolName === "Bash" || toolName === "bash") {
    const command = input.command ?? input.cmd;
    if (typeof command === "string" && command.trim().length > 0) {
      return truncate(command.trim());
    }
  }

  if (
    toolName === "Read" ||
    toolName === "Write" ||
    toolName === "Edit" ||
    toolName === "read" ||
    toolName === "write" ||
    toolName === "edit"
  ) {
    const path = input.file_path ?? input.path;
    if (typeof path === "string" && path.trim().length > 0) {
      return truncate(path.trim());
    }
  }

  if (toolName?.startsWith("mcp__")) {
    const entries = Object.entries(input);
    const firstString = entries.find(([, value]) => typeof value === "string");
    if (firstString && typeof firstString[1] === "string") {
      return truncate(firstString[1]);
    }

    if (entries.length > 0) {
      const [key, value] = entries[0];
      return truncate(`${key}: ${toDisplayString(value)}`);
    }
  }

  const entries = Object.entries(input);
  const firstString = entries.find(([, value]) => typeof value === "string");
  if (firstString && typeof firstString[1] === "string") {
    return truncate(firstString[1]);
  }

  if (entries.length > 0) {
    const [key, value] = entries[0];
    return truncate(`${key}: ${toDisplayString(value)}`);
  }

  return "Review the requested tool invocation.";
}

export function getPermissionDetailEntries(
  toolName: string | null,
  input: PermissionToolInput | null
): Array<{ label: string; value: string }> {
  if (!input) return [];

  if (toolName === "Bash" || toolName === "bash") {
    const command = input.command ?? input.cmd;
    if (typeof command === "string") {
      return [{ label: "Command", value: command }];
    }
  }

  if (
    toolName === "Read" ||
    toolName === "Write" ||
    toolName === "Edit" ||
    toolName === "read" ||
    toolName === "write" ||
    toolName === "edit"
  ) {
    const path = input.file_path ?? input.path;
    if (typeof path === "string") {
      return [{ label: "Path", value: path }];
    }
  }

  return Object.entries(input)
    .slice(0, 6)
    .map(([key, value]) => ({
      label: key,
      value: toDisplayString(value),
    }));
}

export function getPermissionResponseLabel(response: string | null): string | null {
  if (!response) return null;

  // Handle legacy plain-string responses (pre-JSON format)
  const legacy = response.toLowerCase();
  if (legacy === "approved" || legacy === "allowed") return "Allowed";
  if (legacy === "denied" || legacy === "rejected") return "Denied";

  try {
    const parsed = JSON.parse(response) as {
      behavior?: "allow" | "deny";
      alwaysAllow?: boolean;
    };

    if (parsed.behavior === "allow") {
      return parsed.alwaysAllow ? "Always allowed" : "Allowed";
    }

    if (parsed.behavior === "deny") {
      return "Denied";
    }

    return null;
  } catch {
    return null;
  }
}
