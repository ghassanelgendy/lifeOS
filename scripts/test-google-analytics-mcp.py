#!/usr/bin/env python3
"""
lifeOS - Google Analytics MCP Diagnostics and Test Script
Tests stdio communication with analytics-mcp, retrieves tool listings, and verifies setup.
"""

import os
import sys
import json
import subprocess
from pathlib import Path

def main():
    script_dir = Path(__file__).resolve().parent
    project_root = script_dir.parent
    runner = script_dir / "run-google-analytics-mcp.sh"

    print("=" * 60)
    print("lifeOS: Google Analytics MCP Diagnostics")
    print("=" * 60)
    print(f"Project root: {project_root}")
    print(f"Runner script: {runner}")

    # Check environment variables
    creds = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    project_id = os.environ.get("GOOGLE_CLOUD_PROJECT")
    property_id = os.environ.get("GA4_PROPERTY_ID")

    print(f"GOOGLE_APPLICATION_CREDENTIALS: {creds if creds else '(not set)'}")
    print(f"GOOGLE_CLOUD_PROJECT:           {project_id if project_id else '(not set)'}")
    print(f"GA4_PROPERTY_ID:                {property_id if property_id else '(not set)'}")
    print("-" * 60)

    # Launch MCP server subprocess
    cmd = [str(runner)]
    if "--allow-write" in sys.argv:
        cmd.append("--allow-write")

    print(f"Starting MCP server via: {' '.join(cmd)}")
    proc = subprocess.Popen(
        cmd,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )

    try:
        # Step 1: Initialize
        init_req = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "lifeos-test-client", "version": "1.0.0"}
            }
        }
        proc.stdin.write(json.dumps(init_req) + "\n")
        proc.stdin.flush()

        resp_line = proc.stdout.readline()
        if not resp_line:
            err = proc.stderr.read()
            print(f"Error: No response from server. stderr: {err}")
            return 1

        init_resp = json.loads(resp_line)
        server_info = init_resp.get("result", {}).get("serverInfo", {})
        print(f"Connected to: {server_info.get('name')} (v{server_info.get('version')})")
        print(f"Protocol version: {init_resp.get('result', {}).get('protocolVersion')}")

        # Step 2: Initialized notification
        proc.stdin.write(json.dumps({"jsonrpc": "2.0", "method": "notifications/initialized"}) + "\n")
        proc.stdin.flush()

        # Step 3: Tools list
        tools_req = {"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}}
        proc.stdin.write(json.dumps(tools_req) + "\n")
        proc.stdin.flush()

        tools_resp_line = proc.stdout.readline()
        tools_resp = json.loads(tools_resp_line)
        tools = tools_resp.get("result", {}).get("tools", [])

        print(f"\nDiscovered {len(tools)} MCP Tools:")
        for t in tools:
            desc = t.get("description", "").split("\n")[0]
            print(f"  • {t.get('name'):<35} : {desc}")

        print("\nAll MCP server checks passed successfully!")
        if not creds:
            print("\nNote: Set GOOGLE_APPLICATION_CREDENTIALS and GOOGLE_CLOUD_PROJECT in .env to query live GA4 properties.")
        return 0

    except Exception as e:
        print(f"Exception during test: {e}", file=sys.stderr)
        return 1
    finally:
        try:
            proc.stdin.close()
            proc.terminate()
            proc.wait(timeout=2)
        except Exception:
            pass

if __name__ == "__main__":
    sys.exit(main())
