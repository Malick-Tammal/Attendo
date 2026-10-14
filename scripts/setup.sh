#!/usr/bin/env bash
#
# setup.sh — one-shot setup for a fresh clone of face-detection.
#
#   bash scripts/setup.sh
#
# What it does:
#   1. Checks prerequisites (Node.js, npm, Python 3.12)
#   2. Installs Node dependencies  (also regenerates the git-ignored MediaPipe
#      runtime via the `postinstall` hook)
#   3. Creates backend/venv and installs the Python requirements
#
# Safe to re-run: an existing node_modules / backend/venv is reused.

set -euo pipefail

# ── Resolve project root (parent of this script's folder) ─────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$ROOT_DIR"

# ── Output helpers ────────────────────────────────────────────────────
blue='\033[1;34m'
green='\033[1;32m'
yellow='\033[1;33m'
red='\033[1;31m'
reset='\033[0m'
info() { printf "${blue}==>${reset} %s\n" "$*"; }
ok() { printf "${green}  ok${reset}  %s\n" "$*"; }
warn() { printf "${yellow}  !   %s${reset}\n" "$*"; }
die() {
  printf "${red}  x   %s${reset}\n" "$*" >&2
  exit 1
}

# ── Banner ────────────────────────────────────────────────────────────
printf "${blue}"
cat <<'BANNER'
    ____               _           __     _____      __
   / __ \_________    (_)__  _____/ /_   / ___/___  / /___  ______
  / /_/ / ___/ __ \  / / _ \/ ___/ __/   \__ \/ _ \/ __/ / / / __ \
 / ____/ /  / /_/ / / /  __/ /__/ /_    ___/ /  __/ /_/ /_/ / /_/ /
/_/   /_/   \____/_/ /\___/\___/\__/   /____/\___/\__/\__,_/ .___/
                /___/                                     /_/
BANNER
printf "${reset}\n"

# ── 1. Prerequisite checks ────────────────────────────────────────────
info "Checking prerequisites"

command -v node >/dev/null 2>&1 || die "Node.js not found — install Node 20+ from https://nodejs.org"
command -v npm >/dev/null 2>&1 || die "npm not found — it ships with Node.js."

PYTHON_BIN=""
for candidate in python3.12 python3 python; do
  if command -v "$candidate" >/dev/null 2>&1; then
    PYTHON_BIN="$candidate"
    break
  fi
done
[ -n "$PYTHON_BIN" ] || die "Python not found — install Python 3.12 from https://www.python.org/downloads/"

NODE_VER="$(node --version)"
PY_VER="$("$PYTHON_BIN" --version 2>&1)"
ok "Node ${NODE_VER}"
ok "${PY_VER} (${PYTHON_BIN})"

case "$PY_VER" in
*3.12*) ;;
*)
  warn "requirements.txt targets Python 3.12 but found ${PY_VER}."
  warn "Some pinned wheels (e.g. dlib-bin) may not install on other versions."
  ;;
esac

# ── 2. Node / Electron dependencies ───────────────────────────────────
info "Installing Node dependencies (this also regenerates the MediaPipe runtime)"
npm install
ok "Node dependencies installed"

# ── 3. Python backend virtualenv ──────────────────────────────────────
info "Setting up the Python backend virtualenv"
cd "$ROOT_DIR/backend"

if [ -d venv ]; then
  ok "backend/venv already exists — reusing it"
else
  "$PYTHON_BIN" -m venv venv
  ok "Created backend/venv"
fi

VENV_PY="venv/bin/python"
[ -x "$VENV_PY" ] || die "Could not find ${VENV_PY} — virtualenv creation failed."

"$VENV_PY" -m pip install --upgrade pip
"$VENV_PY" -m pip install -r requirements.txt
ok "Python dependencies installed"

# ── 4. Done ───────────────────────────────────────────────────────────
info "Setup complete"

cat <<'EOF'

Before running the app, start MongoDB:
    docker compose up -d mongodb      # or run a local mongod on :27017

Then start the app — Electron launches the Python backend for you:
    npm run dev

To run the backend on its own:
    cd backend
    source venv/bin/activate
    python main.py
EOF
