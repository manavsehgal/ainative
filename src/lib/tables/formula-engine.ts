/**
 * Safe AST-based formula evaluator for computed columns.
 *
 * SECURITY: Pure interpretation — no eval(), Function(), or prototype access.
 * Only allowlisted operators and functions are executable.
 *
 * Syntax:
 *   {{column_name}} — column reference
 *   + - * / %      — arithmetic operators
 *   == != > >= < <= — comparison operators
 *   concat(a, b)   — text concatenation
 *   if(cond, then, else) — conditional
 *   sum(col), avg(col), min(col), max(col), count(col) — aggregates
 *   daysBetween(date1, date2), today() — date functions
 */

// ── AST Node Types ───────────────────────────────────────────────────

type ASTNode =
  | { type: "number"; value: number }
  | { type: "string"; value: string }
  | { type: "boolean"; value: boolean }
  | { type: "column_ref"; name: string }
  | { type: "binary"; op: string; left: ASTNode; right: ASTNode }
  | { type: "unary"; op: string; operand: ASTNode }
  | { type: "call"; name: string; args: ASTNode[] };

// ── Tokenizer ────────────────────────────────────────────────────────

type Token =
  | { type: "number"; value: number }
  | { type: "string"; value: string }
  | { type: "column_ref"; name: string }
  | { type: "ident"; name: string }
  | { type: "op"; value: string }
  | { type: "paren"; value: "(" | ")" }
  | { type: "comma" };

function tokenize(formula: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < formula.length) {
    // Skip whitespace
    if (/\s/.test(formula[i])) { i++; continue; }

    // Column reference: {{name}}
    if (formula[i] === "{" && formula[i + 1] === "{") {
      i += 2;
      let name = "";
      while (i < formula.length && !(formula[i] === "}" && formula[i + 1] === "}")) {
        name += formula[i++];
      }
      i += 2; // skip }}
      tokens.push({ type: "column_ref", name: name.trim() });
      continue;
    }

    // Number
    if (/\d/.test(formula[i]) || (formula[i] === "." && i + 1 < formula.length && /\d/.test(formula[i + 1]))) {
      let num = "";
      while (i < formula.length && /[\d.]/.test(formula[i])) num += formula[i++];
      tokens.push({ type: "number", value: parseFloat(num) });
      continue;
    }

    // String literal
    if (formula[i] === '"' || formula[i] === "'") {
      const quote = formula[i++];
      let str = "";
      while (i < formula.length && formula[i] !== quote) str += formula[i++];
      i++; // skip closing quote
      tokens.push({ type: "string", value: str });
      continue;
    }

    // Operators (2-char first)
    const twoChar = formula.slice(i, i + 2);
    if (["==", "!=", ">=", "<="].includes(twoChar)) {
      tokens.push({ type: "op", value: twoChar });
      i += 2;
      continue;
    }

    // Single-char operators
    if ("+-*/%><!".includes(formula[i])) {
      tokens.push({ type: "op", value: formula[i++] });
      continue;
    }

    // Parentheses
    if (formula[i] === "(" || formula[i] === ")") {
      tokens.push({ type: "paren", value: formula[i++] as "(" | ")" });
      continue;
    }

    // Comma
    if (formula[i] === ",") {
      tokens.push({ type: "comma" });
      i++;
      continue;
    }

    // Identifiers (function names, booleans)
    if (/[a-zA-Z_]/.test(formula[i])) {
      let ident = "";
      while (i < formula.length && /[a-zA-Z0-9_]/.test(formula[i])) ident += formula[i++];

      if (ident === "true") tokens.push({ type: "string", value: "true" });
      else if (ident === "false") tokens.push({ type: "string", value: "false" });
      else tokens.push({ type: "ident", name: ident });
      continue;
    }

    throw new Error(`Unexpected character: ${formula[i]} at position ${i}`);
  }

  return tokens;
}

// ── Parser (recursive descent) ───────────────────────────────────────

class Parser {
  private tokens: Token[];
  private pos = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parse(): ASTNode {
    const node = this.parseExpression();
    if (this.pos < this.tokens.length) {
      throw new Error(`Unexpected token at position ${this.pos}`);
    }
    return node;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private advance(): Token {
    return this.tokens[this.pos++];
  }

  private parseExpression(): ASTNode {
    return this.parseComparison();
  }

  private parseComparison(): ASTNode {
    let left = this.parseAddSub();

    while (this.peek()?.type === "op" && ["==", "!=", ">", ">=", "<", "<="].includes((this.peek() as { value: string }).value)) {
      const op = (this.advance() as { value: string }).value;
      const right = this.parseAddSub();
      left = { type: "binary", op, left, right };
    }

    return left;
  }

  private parseAddSub(): ASTNode {
    let left = this.parseMulDiv();

    while (this.peek()?.type === "op" && ["+", "-"].includes((this.peek() as { value: string }).value)) {
      const op = (this.advance() as { value: string }).value;
      const right = this.parseMulDiv();
      left = { type: "binary", op, left, right };
    }

    return left;
  }

  private parseMulDiv(): ASTNode {
    let left = this.parseUnary();

    while (this.peek()?.type === "op" && ["*", "/", "%"].includes((this.peek() as { value: string }).value)) {
      const op = (this.advance() as { value: string }).value;
      const right = this.parseUnary();
      left = { type: "binary", op, left, right };
    }

    return left;
  }

  private parseUnary(): ASTNode {
    if (this.peek()?.type === "op" && (this.peek() as { value: string }).value === "-") {
      this.advance();
      const operand = this.parsePrimary();
      return { type: "unary", op: "-", operand };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): ASTNode {
    const token = this.peek();
    if (!token) throw new Error("Unexpected end of formula");

    if (token.type === "number") {
      this.advance();
      return { type: "number", value: token.value };
    }

    if (token.type === "string") {
      this.advance();
      return { type: "string", value: token.value };
    }

    if (token.type === "column_ref") {
      this.advance();
      return { type: "column_ref", name: token.name };
    }

    if (token.type === "ident") {
      this.advance();
      if (this.peek()?.type === "paren" && (this.peek() as { value: string }).value === "(") {
        this.advance(); // consume (
        const args: ASTNode[] = [];
        while (!(this.peek()?.type === "paren" && (this.peek() as { value: string }).value === ")")) {
          if (args.length > 0) {
            if (this.peek()?.type !== "comma") throw new Error("Expected comma");
            this.advance();
          }
          args.push(this.parseExpression());
        }
        this.advance(); // consume )
        return { type: "call", name: token.name, args };
      }
      return { type: "column_ref", name: token.name };
    }

    if (token.type === "paren" && token.value === "(") {
      this.advance();
      const expr = this.parseExpression();
      if (!(this.peek()?.type === "paren" && (this.peek() as { value: string }).value === ")")) {
        throw new Error("Expected closing parenthesis");
      }
      this.advance();
      return expr;
    }

    throw new Error(`Unexpected token: ${JSON.stringify(token)}`);
  }
}

// ── Evaluator ────────────────────────────────────────────────────────

const ALLOWED_FUNCTIONS = new Set([
  "sum", "avg", "min", "max", "count",
  "daysBetween", "today", "concat", "if",
  "abs", "round", "floor", "ceil",
]);

interface EvalContext {
  row: Record<string, unknown>;
  allRows?: Record<string, unknown>[];
}

function evaluate(node: ASTNode, ctx: EvalContext): unknown {
  switch (node.type) {
    case "number":
      return node.value;
    case "string":
      return node.value;
    case "boolean":
      return node.value;

    case "column_ref": {
      return ctx.row[node.name] ?? null;
    }

    case "unary": {
      const operand = evaluate(node.operand, ctx);
      if (node.op === "-") return -(Number(operand) || 0);
      return operand;
    }

    case "binary": {
      const left = evaluate(node.left, ctx);
      const right = evaluate(node.right, ctx);

      switch (node.op) {
        case "+": {
          if (typeof left === "string" || typeof right === "string") {
            return String(left ?? "") + String(right ?? "");
          }
          return (Number(left) || 0) + (Number(right) || 0);
        }
        case "-": return (Number(left) || 0) - (Number(right) || 0);
        case "*": return (Number(left) || 0) * (Number(right) || 0);
        case "/": {
          const divisor = Number(right) || 0;
          return divisor === 0 ? null : (Number(left) || 0) / divisor;
        }
        case "%": return (Number(left) || 0) % (Number(right) || 1);
        case "==": return left == right; // eslint-disable-line eqeqeq
        case "!=": return left != right; // eslint-disable-line eqeqeq
        case ">": return Number(left) > Number(right);
        case ">=": return Number(left) >= Number(right);
        case "<": return Number(left) < Number(right);
        case "<=": return Number(left) <= Number(right);
        default: throw new Error(`Unknown operator: ${node.op}`);
      }
    }

    case "call": {
      if (!ALLOWED_FUNCTIONS.has(node.name)) {
        throw new Error(`Unknown function: ${node.name}`);
      }

      switch (node.name) {
        case "if": {
          const condition = evaluate(node.args[0], ctx);
          return condition ? evaluate(node.args[1], ctx) : evaluate(node.args[2], ctx);
        }
        case "concat":
          return node.args.map((a) => String(evaluate(a, ctx) ?? "")).join("");
        case "today":
          return new Date().toISOString().split("T")[0];
        case "daysBetween": {
          const d1 = new Date(String(evaluate(node.args[0], ctx)));
          const d2 = new Date(String(evaluate(node.args[1], ctx)));
          return Math.floor(Math.abs(d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
        }
        case "abs": return Math.abs(Number(evaluate(node.args[0], ctx)) || 0);
        case "round": return Math.round(Number(evaluate(node.args[0], ctx)) || 0);
        case "floor": return Math.floor(Number(evaluate(node.args[0], ctx)) || 0);
        case "ceil": return Math.ceil(Number(evaluate(node.args[0], ctx)) || 0);

        // Aggregate functions
        case "sum": case "avg": case "min": case "max": case "count": {
          if (!ctx.allRows || ctx.allRows.length === 0) return null;
          const colName = node.args[0].type === "column_ref"
            ? node.args[0].name
            : String(evaluate(node.args[0], ctx));
          const values = ctx.allRows
            .map((r) => Number(r[colName]))
            .filter((v) => !isNaN(v));
          if (values.length === 0) return null;
          switch (node.name) {
            case "sum": return values.reduce((a, b) => a + b, 0);
            case "avg": return values.reduce((a, b) => a + b, 0) / values.length;
            case "min": return Math.min(...values);
            case "max": return Math.max(...values);
            case "count": return values.length;
          }
          break;
        }

        default:
          throw new Error(`Unimplemented function: ${node.name}`);
      }
    }
  }
}

// ── Public API ───────────────────────────────────────────────────────

export function parseFormula(formula: string): ASTNode {
  const tokens = tokenize(formula);
  return new Parser(tokens).parse();
}

export function evaluateFormula(
  formula: string,
  row: Record<string, unknown>,
  allRows?: Record<string, unknown>[]
): unknown {
  try {
    const ast = parseFormula(formula);
    return evaluate(ast, { row, allRows });
  } catch {
    return null;
  }
}

export function extractDependencies(formula: string): string[] {
  const deps: string[] = [];
  const re = /\{\{(\w+)\}\}/g;
  let match;
  while ((match = re.exec(formula)) !== null) {
    deps.push(match[1]);
  }
  return [...new Set(deps)];
}

export function hasCyclicDependencies(
  columns: Array<{ name: string; dependencies?: string[] }>
): boolean {
  const graph = new Map<string, string[]>();
  for (const col of columns) {
    graph.set(col.name, col.dependencies ?? []);
  }

  const visited = new Set<string>();
  const inStack = new Set<string>();

  function dfs(node: string): boolean {
    if (inStack.has(node)) return true;
    if (visited.has(node)) return false;
    visited.add(node);
    inStack.add(node);
    for (const dep of graph.get(node) ?? []) {
      if (dfs(dep)) return true;
    }
    inStack.delete(node);
    return false;
  }

  for (const col of columns) {
    if (dfs(col.name)) return true;
  }
  return false;
}
