# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Single-board Kanban project management MVP. FastAPI backend serves the static Next.js frontend export from one Docker container. Login is hardcoded: username `user`, password `password`.

## Commands

### Backend (run from `backend/`)

```bash
uvicorn backend.main:app --reload   # dev server (from project root)
pytest                              # all tests
pytest test_main.py                 # auth + AI proxy tests only
pytest test_board.py                # card CRUD tests only
```

### Frontend (run from `frontend/`)

```bash
npm run dev            # Next.js dev server (http://localhost:3000)
npm run build          # static export → frontend/out/
npm run lint           # ESLint
npm run test:unit      # Vitest unit tests (one-shot)
npm run test:unit:watch  # Vitest watch mode
npm run test:e2e       # Playwright e2e (requires dev server running)
npm run test:all       # unit + e2e
```

### Docker (from project root)

```bash
docker compose up --build -d   # build and start at http://localhost:8000
docker compose down
.\scripts\start.ps1            # Windows helper
.\scripts\stop.ps1
```

## Environment Setup

Create a `.env` file in the project root for AI features:

```
OPENROUTER_API_KEY=your_key_here
```

Without this, `/api/ai` returns HTTP 500. The SQLite database (`backend/pm.db`) is created automatically on first run.

## Architecture

**Request flow:** Browser → FastAPI (`:8000`) → serves static Next.js SPA from `backend/static/` → SPA calls `/api/*` endpoints → SQLite (`pm.db`)

**Auth:** Cookie-based session. `AuthGate.tsx` checks `/api/auth-status` on mount; unauthenticated users are redirected to `/login`.

**Board state:** The entire board is stored as a single JSON blob in SQLite (`kanban_json` column), keyed by `user_id`. `db.py` provides `get_board()` / `upsert_board()`.

**AI flow:** `ChatSidebar.tsx` → `POST /api/ai` → FastAPI proxies to OpenRouter (`openai/gpt-oss-120b:free`) → returns `{ response, kanbanUpdate }` → valid updates are persisted and applied to the board.

**DnD:** Managed by `@dnd-kit` entirely on the frontend. `lib/kanban.ts` contains all board types (`BoardData`, `Card`, `Column`) and pure helper functions (`moveCard`, `findColumnId`, `getCardPosition`, `createId`).

## Key Files

| File | Purpose |
|---|---|
| `backend/main.py` | All API routes: auth, board CRUD, card CRUD, AI proxy, static serving |
| `backend/db.py` | SQLite init + board read/write |
| `frontend/src/components/KanbanBoard.tsx` | Top-level board state, DnD context, API integration |
| `frontend/src/components/ChatSidebar.tsx` | AI assistant panel; applies board updates from AI response |
| `frontend/src/lib/kanban.ts` | Shared types and pure board-manipulation utilities |

## Testing Notes

- Playwright e2e tests use `http://127.0.0.1:3000` and auto-start `npm run dev`
- Vitest uses jsdom with `@` aliased to `src/`
- Backend tests use FastAPI `TestClient` (via `httpx`); the SQLite DB is created in-memory per test run
