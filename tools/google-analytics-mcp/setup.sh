#!/usr/bin/env bash
# ==============================================================================
# lifeOS - Google Analytics MCP Setup Script
# ==============================================================================
# Sets up a dedicated Python 3.12 virtualenv and installs analytics-mcp in editable mode.
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "Setting up Google Analytics MCP in $SCRIPT_DIR..."

if command -v uv >/dev/null 2>&1; then
  echo "Using 'uv' to create virtual environment (Python 3.12)..."
  uv venv --python 3.12 .venv
  echo "Installing analytics-mcp in editable mode..."
  uv pip install -e . --python .venv/bin/python
elif command -v python3 >/dev/null 2>&1; then
  echo "Using python3 -m venv..."
  python3 -m venv .venv
  .venv/bin/pip install -e .
else
  echo "Error: Neither 'uv' nor 'python3' found." >&2
  exit 1
fi

echo "Verifying installation..."
.venv/bin/analytics-mcp --help >/dev/null

echo "Setup complete! 'analytics-mcp' is ready."
