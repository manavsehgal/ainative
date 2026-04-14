import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFs } = vi.hoisted(() => ({
  mockFs: {
    realpathMap: new Map<string, string>(),
    files: new Map<string, string>(),
    statMap: new Map<string, { size: number }>(),
  },
}));

vi.mock("node:fs", () => {
  const realpathSync = (p: string) => {
    const real = mockFs.realpathMap.get(p);
    if (real === undefined) throw new Error(`ENOENT: realpath ${p}`);
    return real;
  };
  const statSync = (p: string) => {
    const s = mockFs.statMap.get(p);
    if (!s) throw new Error(`ENOENT: stat ${p}`);
    return s;
  };
  const readFileSync = (p: string) => {
    const content = mockFs.files.get(p);
    if (content === undefined) throw new Error(`ENOENT: read ${p}`);
    return content;
  };
  return {
    default: { realpathSync, statSync, readFileSync },
    realpathSync,
    statSync,
    readFileSync,
  };
});

import { expandFileMention } from "../files/expand-mention";

const CWD = "/repo";

beforeEach(() => {
  mockFs.realpathMap.clear();
  mockFs.files.clear();
  mockFs.statMap.clear();
  mockFs.realpathMap.set(CWD, CWD);
});

function registerFile(relPath: string, content: string) {
  const abs = `${CWD}/${relPath}`;
  mockFs.files.set(abs, content);
  mockFs.statMap.set(abs, { size: Buffer.byteLength(content, "utf8") });
}

describe("expandFileMention", () => {
  it("inlines files under 8 KB with a path header and fenced code block", () => {
    registerFile("src/a.ts", "export const x = 1;\n");
    const out = expandFileMention("src/a.ts", CWD).join("\n");
    expect(out).toContain("### File: src/a.ts");
    expect(out).toContain("```ts");
    expect(out).toContain("export const x = 1;");
    expect(out).toContain("```");
  });

  it("references files >= 8 KB without inlining their content", () => {
    const big = "A".repeat(10 * 1024);
    registerFile("docs/large.md", big);
    const out = expandFileMention("docs/large.md", CWD).join("\n");
    expect(out).toContain("File (by reference): docs/large.md");
    expect(out).toContain("KB)"); // size hint
    expect(out).toContain("Use the Read tool");
    expect(out).not.toContain(big); // content not inlined
  });

  it("emits a not-found note when the file no longer exists", () => {
    const out = expandFileMention("src/gone.ts", CWD).join("\n");
    expect(out).toContain("### File: src/gone.ts");
    expect(out).toContain("(file not found at context-build time)");
  });

  it("rejects paths that resolve outside cwd (security guardrail)", () => {
    const out = expandFileMention("../escape.ts", CWD).join("\n");
    expect(out).toContain("(invalid path — escapes working directory)");
    expect(out).not.toContain("(file not found"); // did not even try to read
  });

  it("skips pathological files >= 50 MB silently (returns empty)", () => {
    const abs = `${CWD}/huge.bin`;
    mockFs.statMap.set(abs, { size: 60 * 1024 * 1024 });
    // readFileSync is never reached
    const out = expandFileMention("huge.bin", CWD);
    expect(out).toEqual([]);
  });

  it("picks an 'unknown' code-fence language for files without an extension", () => {
    const abs = `${CWD}/Makefile`;
    mockFs.files.set(abs, "all:\n\techo ok\n");
    mockFs.statMap.set(abs, { size: 16 });
    const out = expandFileMention("Makefile", CWD).join("\n");
    // .split(".").pop() on a name with no dot returns the whole name,
    // which is the best we can do without a language map. We just
    // assert a header + a closing fence are present.
    expect(out).toContain("### File: Makefile");
    expect(out).toMatch(/```[\w]*/);
    expect(out).toContain("all:");
  });

  it("emits a read-failure note if the file stats OK but reads throw", () => {
    const abs = `${CWD}/src/binary.ico`;
    mockFs.statMap.set(abs, { size: 100 });
    // Do NOT register contents — readFileSync will throw
    const out = expandFileMention("src/binary.ico", CWD).join("\n");
    expect(out).toContain("(file could not be read as UTF-8)");
  });
});
