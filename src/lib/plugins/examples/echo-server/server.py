#!/usr/bin/env python3
"""
Echo Server — minimal stdio MCP reference plugin for ainative.

Responds to MCP JSON-RPC 2.0 initialize + tools/list + tools/call. Exposes a
single tool "echo" that returns its { text } input wrapped as { echoed }.

Zero dependencies beyond the Python standard library. Python 3.9+.
"""
import json
import sys


PROTOCOL_VERSION = "2024-11-05"
SERVER_NAME = "echo-server"
SERVER_VERSION = "0.1.0"


def _reply(obj):
    sys.stdout.write(json.dumps(obj) + "\n")
    sys.stdout.flush()


def _handle_initialize(request):
    return {
        "jsonrpc": "2.0",
        "id": request.get("id"),
        "result": {
            "protocolVersion": PROTOCOL_VERSION,
            "serverInfo": {"name": SERVER_NAME, "version": SERVER_VERSION},
            "capabilities": {"tools": {}},
        },
    }


def _handle_tools_list(request):
    return {
        "jsonrpc": "2.0",
        "id": request.get("id"),
        "result": {
            "tools": [
                {
                    "name": "echo",
                    "description": "Return the input text verbatim wrapped as { echoed }.",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "text": {
                                "type": "string",
                                "description": "Text to echo back.",
                            }
                        },
                        "required": ["text"],
                    },
                }
            ]
        },
    }


def _handle_tools_call(request):
    params = request.get("params") or {}
    name = params.get("name")
    if name != "echo":
        return {
            "jsonrpc": "2.0",
            "id": request.get("id"),
            "error": {"code": -32601, "message": f"Unknown tool: {name}"},
        }
    arguments = params.get("arguments") or {}
    text = arguments.get("text", "")
    if not isinstance(text, str):
        return {
            "jsonrpc": "2.0",
            "id": request.get("id"),
            "error": {"code": -32602, "message": "text must be a string"},
        }
    return {
        "jsonrpc": "2.0",
        "id": request.get("id"),
        "result": {
            "content": [
                {"type": "text", "text": json.dumps({"echoed": text})}
            ]
        },
    }


HANDLERS = {
    "initialize": _handle_initialize,
    "tools/list": _handle_tools_list,
    "tools/call": _handle_tools_call,
}


def main():
    for raw in sys.stdin:
        line = raw.strip()
        if not line:
            continue
        try:
            request = json.loads(line)
        except json.JSONDecodeError:
            continue

        method = request.get("method")
        # Notifications have no "id" — do not reply (JSON-RPC 2.0).
        if "id" not in request:
            continue

        handler = HANDLERS.get(method)
        if handler is None:
            _reply(
                {
                    "jsonrpc": "2.0",
                    "id": request.get("id"),
                    "error": {
                        "code": -32601,
                        "message": f"Method not found: {method}",
                    },
                }
            )
            continue
        _reply(handler(request))


if __name__ == "__main__":
    main()
