#!/usr/bin/env bash
# Cloud Agent environment install for hermes-agent.
#
# Idempotent: safe to run repeatedly and against cached/partial state. It
# prepares the two development toolchains this repo uses:
#   * Python — a repo-local .venv (probed first by scripts/run_tests.sh)
#     with the project installed editable, all runtime extras, and dev tools.
#   * Node   — npm workspaces (TUI, web, desktop, tests-js) plus the
#     @hermes/ink bundle the TUI's tests and dev server import at runtime.
#
# Runs after the repo is checked out. It must terminate and start no
# long-lived processes.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "▶ hermes-agent install: repo root = $REPO_ROOT"

# ── Python: uv ───────────────────────────────────────────────────────────────
# uv manages the interpreter and the editable install. Install it if the base
# image doesn't already ship it.
export PATH="$HOME/.local/bin:$PATH"
if ! command -v uv >/dev/null 2>&1; then
  echo "▶ installing uv"
  curl -LsSf https://astral.sh/uv/install.sh | sh
  export PATH="$HOME/.local/bin:$PATH"
fi
echo "▶ uv $(uv --version)"

# ── Python: repo-local venv ──────────────────────────────────────────────────
# .python-version pins 3.11; uv downloads it if the host lacks it. Keep the
# venv in-tree at .venv so scripts/run_tests.sh finds it without configuration.
if [ ! -x ".venv/bin/python" ]; then
  echo "▶ creating .venv (python 3.11)"
  uv venv .venv --python 3.11
fi

# Editable install with every non-lazy extra ([all]) plus dev tooling
# (pytest, ruff, ty). --python targets the repo venv explicitly so this works
# whether or not the venv is "activated" in the calling shell.
echo "▶ installing hermes-agent[all,dev] (editable)"
uv pip install --python .venv/bin/python -e ".[all,dev]"

# ── Node: locate a suitable toolchain ────────────────────────────────────────
# package.json requires node >=22.22.0. The base image provides it via nvm;
# source nvm when node isn't already on PATH (install runs non-interactively).
if ! command -v node >/dev/null 2>&1; then
  if [ -s "$HOME/.nvm/nvm.sh" ]; then
    # shellcheck disable=SC1091
    . "$HOME/.nvm/nvm.sh"
    nvm use --lts >/dev/null 2>&1 || true
  fi
fi

if command -v node >/dev/null 2>&1; then
  echo "▶ node $(node --version), npm $(npm --version)"

  # npm ci installs strictly from package-lock.json (never rewrites it).
  echo "▶ npm ci (workspaces)"
  npm ci

  # The TUI imports @hermes/ink from packages/hermes-ink/dist at runtime and in
  # its vitest suite; npm ci does not build workspace sources, so build the ink
  # bundle and the TUI entry explicitly. Both are fast esbuild bundles.
  echo "▶ building @hermes/ink + TUI entry"
  npm run build:ink --workspace ui-tui
  npm run build --workspace ui-tui
else
  echo "⚠ node not found — skipping Node workspace setup (Python setup is complete)"
fi

echo "✅ hermes-agent install complete"
