import type { Sanitizer } from "./types";

export const shiftSanitizer: Sanitizer = {
  name: "shift",
  sanitize(value, params) {
    if (value == null) return null;
    const str = String(value);
    const date = new Date(str);
    if (isNaN(date.getTime())) return value;

    const offsetDays = (params.offsetDays as number) ?? -30;
    date.setDate(date.getDate() + offsetDays);
    return date.toISOString().split("T")[0];
  },
};
