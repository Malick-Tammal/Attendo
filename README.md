# Attendo

An Electron + React (TypeScript) desktop app for real-time face detection and
attendance, backed by a Python (FastAPI) service and MongoDB.

## Tech stack

| Layer    | Tech                                                          |
| -------- | ------------------------------------------------------------- |
| Desktop  | Electron + electron-vite                                      |
| Frontend | React 19, TypeScript, Tailwind CSS v4, HeroUI                 |
| Vision   | MediaPipe Tasks Vision (BlazeFace, on-device)                 |
| Backend  | Python 3.12, FastAPI, Uvicorn, WebSockets, `face-recognition` |
| Database | MongoDB                                                       |

## Prerequisites

- **Node.js 20+** and npm — <https://nodejs.org>
- **Python 3.12** — <https://www.python.org/downloads/>
- **MongoDB** (local or via Docker) — the backend connects to
  `mongodb://localhost:27017`

## Setup from a fresh clone

One command does everything:

```bash
npm run setup
```

It checks your tooling, runs `npm install` (which also regenerates the
git-ignored MediaPipe runtime via the `postinstall` hook), creates
`backend/venv`, and installs the Python requirements. It is safe to re-run.

Equivalent to running the script directly: `bash scripts/setup.sh`.

<details>
<summary>Manual setup (if you prefer to do it by hand)</summary>

```bash
# 1. Node / Electron dependencies — also regenerates the MediaPipe runtime
npm install

# 2. Python backend virtualenv
cd backend
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install --upgrade pip
pip install -r requirements.txt
cd ..
```

</details>

## Running

Start MongoDB first:

```bash
npm run db:up      # docker compose up -d mongodb
```

Then start the app:

```bash
npm run dev
```

Electron automatically launches the Python backend
(`backend/venv/bin/python backend/main.py`) — you do **not** need to start it
separately.

To stop MongoDB when you're done:

```bash
npm run db:down    # docker compose down (data persists in the mongodb_data volume)
```

To run the backend on its own:

```bash
cd backend
source venv/bin/activate
python main.py                    # serves on http://127.0.0.1:8000
```

## Building

```bash
npm run build:win                 # Windows
npm run build:mac                 # macOS
npm run build:linux               # Linux
```

## Recommended IDE setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Project structure

```text
backend/                     Python FastAPI backend
  core/                      config (Mongo URI) + database client
  services/                  face engine, attendance logic
  known_faces/               runtime face data (git-ignored, .gitkeep kept)
  models/                    downloaded ML models (git-ignored, .gitkeep kept)
  main.py                    HTTP + WebSocket entrypoint
  requirements.txt           pinned Python dependencies
src/
  main/                      Electron main process (window, backend spawner)
  preload/                   Electron preload bridge
  renderer/                  React app (public/mediapipe is auto-generated)
scripts/
  setup.sh                   one-shot dev setup
  copy-mediapipe.mjs         copies WASM + downloads BlazeFace model (postinstall)
build/                       electron-builder assets (icons, entitlements)
docker-compose.yml           MongoDB service
```

## Notes

- **MediaPipe runtime** (`src/renderer/public/mediapipe/`, ~35 MB) is **not**
  committed — it is regenerated on `npm install` by
  `scripts/copy-mediapipe.mjs`.
- **`backend/known_faces/` and `backend/models/`** are runtime/data folders;
  their contents are git-ignored (only `.gitkeep` is tracked).
- **Windows**: activate the venv with `venv\Scripts\activate`. The Electron
  backend spawner currently uses the POSIX `venv/bin/python` path, so running
  the backend manually on Windows may need `venv\Scripts\python.exe`.
