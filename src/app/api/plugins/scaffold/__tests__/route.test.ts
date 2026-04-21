import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  PluginSpecAlreadyExistsError,
  PluginSpecInvalidIdError,
  PluginSpecWriteError,
} from "@/lib/chat/tools/plugin-spec-tools";

vi.mock("@/lib/chat/tools/plugin-spec-tools", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/chat/tools/plugin-spec-tools")
  >("@/lib/chat/tools/plugin-spec-tools");
  return {
    ...actual,
    scaffoldPluginSpec: vi.fn(),
  };
});

import { scaffoldPluginSpec } from "@/lib/chat/tools/plugin-spec-tools";
import { POST } from "../route";

const validInput = {
  id: "github-mine",
  name: "GitHub (personal)",
  description: "Personal GitHub integration.",
  capabilities: [],
  transport: "stdio" as const,
  language: "python" as const,
  tools: [{ name: "fetch_items", description: "Fetch items from GitHub." }],
};

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/plugins/scaffold", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/plugins/scaffold", () => {
  beforeEach(() => {
    vi.mocked(scaffoldPluginSpec).mockReset();
  });

  it("returns 200 + scaffold result on happy path", async () => {
    vi.mocked(scaffoldPluginSpec).mockReturnValue({
      ok: true,
      id: "github-mine",
      pluginDir: "/tmp/.ainative/plugins/github-mine",
      files: {
        pluginYaml: "plugin.yaml",
        mcpJson: ".mcp.json",
        serverPy: "server.py",
        readme: "README.md",
      },
      tools: ["fetch_items"],
      message: "Scaffolded github-mine. Reload ainative to register.",
    });

    const res = await POST(makeRequest(validInput));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.pluginDir).toBe("/tmp/.ainative/plugins/github-mine");
    expect(body.tools).toEqual(["fetch_items"]);
  });

  it("returns 400 + invalid_id on PluginSpecInvalidIdError", async () => {
    vi.mocked(scaffoldPluginSpec).mockImplementation(() => {
      throw new PluginSpecInvalidIdError("BAD ID", "must be kebab-case");
    });

    const res = await POST(makeRequest(validInput));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("invalid_id");
    expect(body.error).toContain("BAD ID");
  });

  it("returns 409 + already_exists on PluginSpecAlreadyExistsError", async () => {
    vi.mocked(scaffoldPluginSpec).mockImplementation(() => {
      throw new PluginSpecAlreadyExistsError("/tmp/github-mine");
    });

    const res = await POST(makeRequest(validInput));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("already_exists");
  });

  it("returns 500 + write_failed on PluginSpecWriteError", async () => {
    vi.mocked(scaffoldPluginSpec).mockImplementation(() => {
      throw new PluginSpecWriteError("/tmp/github-mine", new Error("EACCES"));
    });

    const res = await POST(makeRequest(validInput));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.code).toBe("write_failed");
  });

  it("returns 400 on malformed JSON body", async () => {
    const badReq = new Request("http://localhost/api/plugins/scaffold", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });
    const res = await POST(badReq);
    expect(res.status).toBe(400);
  });

  it("returns 400 on Zod validation failure", async () => {
    const res = await POST(makeRequest({ id: "x" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });
});
