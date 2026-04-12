import type { Sanitizer } from "./types";

export const randomizeSanitizer: Sanitizer = {
  name: "randomize",
  sanitize(_value, params) {
    const min = (params.min as number) ?? 0;
    const max = (params.max as number) ?? 100;
    const step = (params.step as number) ?? 1;
    const type = (params.type as string) ?? "int";

    const range = max - min;
    if (type === "float") {
      return Math.round((min + Math.random() * range) * 100) / 100;
    }
    const steps = Math.floor(range / step);
    return min + Math.floor(Math.random() * (steps + 1)) * step;
  },
};
