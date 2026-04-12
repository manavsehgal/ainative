import type { Sanitizer } from "./types";

export const keepSanitizer: Sanitizer = {
  name: "keep",
  sanitize(value) {
    return value;
  },
};
