import type { Sanitizer } from "./types";

export const redactSanitizer: Sanitizer = {
  name: "redact",
  sanitize(_value, params) {
    return (params.placeholder as string) ?? null;
  },
};
