# Echo Server

A minimal stdio MCP reference plugin that validates the Kind-1 (`chat-tools`)
plugin surface end-to-end. Exposes a single tool — `echo` — that returns its
input verbatim.

**What's inside:**
- `plugin.yaml` — `kind: chat-tools`, `capabilities: []` (no network, no fs, no
  child_process, no env)
- `.mcp.json` — stdio transport, launches `python3 ${PLUGIN_DIR}/server.py`
- `server.py` — ~100 LOC Python that speaks MCP JSON-RPC 2.0 over stdin/stdout

**Prerequisites:**
- Python 3.9+ on `PATH` as `python3` (pre-installed on macOS and most Linux
  distros; on Windows install from python.org or the Microsoft Store)

**How it loads:**
1. On first boot with an empty `~/.ainative/plugins/` directory, ainative
   copies this plugin into `~/.ainative/plugins/echo-server/`.
2. Because `capabilities: []` is empty, the first-install capability-accept
   sheet allows the grant without security warnings.
3. The MCP loader discovers `.mcp.json`, validates the server responds to an
   `initialize` handshake, and registers tools under the prefix
   `mcp__echo-server__`.
4. From any chat session, call the tool with:

   ```
   mcp__echo-server__echo({ "text": "hello ainative" })
   ```

   The server replies with the JSON `{ "echoed": "hello ainative" }`.

**Why it exists:**
- Regression-proofs the Kind-1 plugin pipeline (manifest → MCP validation →
  tool discovery → invocation) with zero external moving parts.
- Reference point for plugin authors: copy this structure, add your own
  `command`/`args`/tools, declare real `capabilities: []` entries as needed.
- Anchors the plugin security model — see `docs/plugin-security.md`
  (forthcoming) for the full capability + confinement story.

**Not shipped:**
- An in-process Agent-SDK dogfood plugin is deferred to M3.5+.
