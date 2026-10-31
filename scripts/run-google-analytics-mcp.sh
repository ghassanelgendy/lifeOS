#!/usr/bin/env bash
# ==============================================================================
# lifeOS - Google Analytics MCP Server Runner
# ==============================================================================
# This script launches the Google Analytics MCP server via stdio for AI agents
# (Antigravity, Claude Code, Cursor, Windsurf) and local scripts.
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Load environment variables from .env or .env.local if present
if [ -f "$PROJECT_ROOT/.env" ]; then
  # shellcheck disable=SC2046
  export $(grep -v '^#' "$PROJECT_ROOT/.env" | xargs -r) 2>/dev/null || true
fi

if [ -f "$PROJECT_ROOT/.env.local" ]; then
  # shellcheck disable=SC2046
  export $(grep -v '^#' "$PROJECT_ROOT/.env.local" | xargs -r) 2>/dev/null || true
fi

# Auto-detect service account or credentials JSON if not set
if [ -z "${GOOGLE_APPLICATION_CREDENTIALS:-}" ]; then
  for candidate in \
    "${HOME}/.config/google-analytics-mcp/service-account.json" \
    "${HOME}/.config/google-analytics-mcp/credentials.json" \
    "$PROJECT_ROOT/service-account.json" \
    "$PROJECT_ROOT/credentials.json" \
    "$PROJECT_ROOT/google-credentials.json" \
    "$PROJECT_ROOT/tools/google-analytics-mcp/service-account.json" \
    "$PROJECT_ROOT/tools/google-analytics-mcp/credentials.json"; do
    if [ -f "$candidate" ]; then
      export GOOGLE_APPLICATION_CREDENTIALS="$candidate"
      break
    fi
  done
fi

# Resolve relative path in GOOGLE_APPLICATION_CREDENTIALS if set
if [ -n "${GOOGLE_APPLICATION_CREDENTIALS:-}" ] && [[ "$GOOGLE_APPLICATION_CREDENTIALS" != /* ]]; then
  export GOOGLE_APPLICATION_CREDENTIALS="$PROJECT_ROOT/$GOOGLE_APPLICATION_CREDENTIALS"
fi

VENV_BIN="$PROJECT_ROOT/tools/google-analytics-mcp/.venv/bin/analytics-mcp"

if [ -x "$VENV_BIN" ]; then
  exec "$VENV_BIN" "$@"
elif command -v uv >/dev/null 2>&1; then
  exec uv run --directory "$PROJECT_ROOT/tools/google-analytics-mcp" --python 3.12 analytics-mcp "$@"
elif command -v uvx >/dev/null 2>&1; then
  exec uvx --python 3.12 analytics-mcp "$@"
elif command -v pipx >/dev/null 2>&1; then
  exec pipx run analytics-mcp "$@"
else
  echo "Error: analytics-mcp executable not found in $VENV_BIN and uv/pipx not available." >&2
  echo "Please run: bash tools/google-analytics-mcp/setup.sh" >&2
  exit 1
fi
