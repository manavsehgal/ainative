import type { Sanitizer } from "./types";

export const deriveSanitizer: Sanitizer = {
  name: "derive",
  sanitize(_value, params, context) {
    const formula = (params.formula as string) ?? "";
    if (!formula) return null;

    // Simple expression evaluator: supports column references + arithmetic
    // Only handles patterns like "colA * colB", "colA + colB", "colA - colB"
    const tokens = formula.split(/\s*([\+\-\*\/])\s*/);
    if (tokens.length < 3) return null;

    const resolve = (token: string): number => {
      const num = Number(token);
      if (!isNaN(num)) return num;
      const val = context.otherColumns[token];
      return typeof val === "number" ? val : Number(val) || 0;
    };

    let result = resolve(tokens[0]);
    for (let i = 1; i < tokens.length; i += 2) {
      const op = tokens[i];
      const operand = resolve(tokens[i + 1]);
      switch (op) {
        case "+": result += operand; break;
        case "-": result -= operand; break;
        case "*": result *= operand; break;
        case "/": result = operand !== 0 ? result / operand : 0; break;
      }
    }
    return Math.round(result * 100) / 100;
  },
};
