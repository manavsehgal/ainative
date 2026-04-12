import { createHash } from "crypto";
import type { Sanitizer } from "./types";

export const hashSanitizer: Sanitizer = {
  name: "hash",
  sanitize(value, params) {
    if (value == null) return null;
    const prefix = (params.prefix as string) ?? "";
    const hash = createHash("sha256")
      .update(String(value))
      .digest("hex")
      .slice(0, 8)
      .toUpperCase();
    return `${prefix}${hash}`;
  },
};
