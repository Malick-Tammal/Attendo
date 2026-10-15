# Contributing to Attendo

Thanks for contributing! Attendo is an Electron + React (TypeScript) desktop app for real-time face-recognition attendance, backed by a Python (FastAPI) service and MongoDB.

## Setup

See [README.md](README.md) for full setup — `npm run setup` does everything.

## Common commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the app (Electron + Python backend) |
| `npm run lint` | ESLint check |
| `npm run format` | Prettier — format all files |
| `npm run typecheck` | TypeScript check (run before committing) |
| `npm run build` | Type-check + production build |

Backend: `cd backend && source venv/bin/activate && python main.py` (serves on `http://127.0.0.1:8000`).

## Commit messages

Short, imperative, and technical. Keep messages scannable — a reader should understand the change without opening a diff.

### Format

```
<Subject line>

- <change>
- <change>
```

### Rules

1. **Subject line** — one line, under 72 characters, imperative mood ("Improve", not "Improved" or "Improves"). No trailing period. Summarize the overall goal, not a list of files.
2. **Body** — bullet list, one bullet per logical change. Each bullet starts with an imperative verb (Add, Fix, Remove, Tighten, Show, Update). Group related changes into a single bullet when they belong together.
3. **Be technical, not vague** — include concrete values, thresholds, and component names where they matter (`0.5`, `50 samples`, `RegisterView`). Avoid filler like "improve performance" or "update stuff".
4. **No trailers** (Co-authored-by, etc.) unless it's a merge or release commit.

### Example (real commit from this repo)

```
Improve face recognition accuracy and tracking

- Add IoU-based face tracker to stop label flicker between frames
- Tighten match tolerance to 0.5 and store 5 augmented encodings per employee
- Auto-learn from high-confidence recognitions (cap 50 samples)
- Show 5-step registration progress UI in RegisterView
- Remove unused backend/models and backend/scripts folders
```

### Anti-patterns

```
- improved the face stuff
- update files
- fix bugs
```

Vague, non-imperative, no technical detail — don't do this.
