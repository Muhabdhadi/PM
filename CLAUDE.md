# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Single-board Kanban project management MVP. FastAPI backend serves the static Next.js frontend export from one Docker container. Login credentials default to `user` / `password` but are overridable via `APP_USERNAME` / `APP_PASSWORD` env vars.

## Commands

### Backend (run from project root)

```bash
uvicorn backend.main:app --reload   # dev server on :8000
```

### Backend tests (run from `backend/`)

```bash
pytest                   # all 8 backend tests
pytest test_main.py      # auth + AI proxy tests
pytest test_board.py     # card CRUD tests
pytest -k test_name      # single test by name
```

### Frontend (run from `frontend/`)

```bash
npm run dev              # Next.js dev server (http://localhost:3000)
npm run build            # static export → frontend/out/
npm run lint             # ESLint
npm run test:unit        # Vitest unit tests (7 tests, one-shot)
npm run test:unit:watch  # Vitest watch mode
npm run test:e2e         # Playwright e2e (3 tests — builds frontend, starts backend on :8000)
npm run test:all         # unit + e2e
```

### Docker (from project root)

```bash
docker compose up --build -d   # build and start at http://localhost:8000
docker compose down
.\scripts\start.ps1            # Windows helper
.\scripts\stop.ps1
```

## Environment Setup

Create a `.env` file in the project root:

```
OPENROUTER_API_KEY=your_key_here   # required for AI features; /api/ai returns 500 without it
APP_USERNAME=user                   # optional override (default: user)
APP_PASSWORD=password               # optional override (default: password)
COOKIE_SECURE=false                 # set true behind HTTPS
```

The SQLite database (`backend/pm.db`) is created automatically on first run.

## Architecture

**Request flow:** Browser → FastAPI (`:8000`) → serves static Next.js SPA from `backend/static/` → SPA calls `/api/*` endpoints → SQLite (`pm.db`)

**Auth:** Cookie-based sessions stored in SQLite `sessions` table with 24-hour TTL. `AuthGate.tsx` checks `/api/auth-status` on mount; unauthenticated users are redirected to `/login`. Login is rate-limited to 10 req/min per IP via `slowapi`.

**Board state:** The entire board is stored as a single JSON blob in SQLite (`kanban_json` column), keyed by `user_id`. `db.py` provides `get_board()` / `upsert_board()` using thread-local connections.

**AI flow:** `ChatSidebar.tsx` → `POST /api/ai` → FastAPI proxies to OpenRouter (`openai/gpt-oss-120b:free`) → returns `{ response, kanbanUpdate }` → response validated against `StructuredAIResponse` Pydantic model → valid updates are merged onto (not replaced) the existing board and persisted.

**DnD:** Managed by `@dnd-kit` entirely on the frontend. `lib/kanban.ts` contains all board types (`BoardData`, `Card`, `Column`) and pure helper functions (`moveCard`, `findColumnId`, `getCardPosition`, `createId`).

## Backend module layout

`backend/main.py` was refactored from a 230-line monolith into focused modules:

| File | Purpose |
|---|---|
| `backend/main.py` | Thin app factory — wires lifespan, middleware, routers, static serving (~45 lines) |
| `backend/config.py` | Env-var loading, constants, shared `slowapi` `Limiter` instance |
| `backend/models.py` | All Pydantic request/response models |
| `backend/db.py` | SQLite init, thread-local connections, board + session read/write |
| `backend/auth.py` | `/api/login`, `/api/logout`, `/api/auth-status`; `get_username_from_session` FastAPI dependency |
| `backend/board.py` | `/api/board` (GET/PUT) and `/api/cards` (POST/PATCH/DELETE); `DEFAULT_BOARD` constant |
| `backend/ai.py` | `/api/ai` OpenRouter proxy, message builder, JSON extractor, board merge logic |

**Import note:** `main.py` runs `sys.path.insert(0, os.path.dirname(__file__))` before any local imports so sibling modules resolve correctly from both the project root (`uvicorn backend.main:app`) and the `backend/` directory (`pytest`).

**Shared limiter:** The `slowapi` `Limiter` instance is defined once in `config.py` and used as both `@config.limiter.limit()` in `auth.py` and `app.state.limiter` in `main.py` — required for the middleware and decorator to share the same counter.

## Key Frontend Files

| File | Purpose |
|---|---|
| `frontend/src/components/KanbanBoard.tsx` | Top-level board state, DnD context, API integration |
| `frontend/src/components/ChatSidebar.tsx` | AI assistant panel; typed with `BoardData`; applies board updates from AI response |
| `frontend/src/lib/kanban.ts` | Shared types and pure board-manipulation utilities |

## Testing Notes

- **Backend:** `conftest.py` provides a `client` fixture with a `tmp_path`-scoped SQLite DB — each test gets a fully isolated database. Monkeypatching `requests.post` targets `ai.requests`, not `main.requests`.
- **Frontend unit:** Vitest with jsdom; `@` aliased to `src/`.
- **E2E:** Playwright `globalSetup` builds the frontend (`npm run build`), copies `frontend/out/` to `backend/static/`, then Playwright boots the real FastAPI backend on port 8000. Tests run against `http://127.0.0.1:8000`.
