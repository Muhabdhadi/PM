# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Multi-user Kanban project management app. FastAPI backend serves the static Next.js frontend export from one Docker container. Users self-register (`/api/register`) or log in; a default `user` / `password` account is seeded (overridable via `APP_USERNAME` / `APP_PASSWORD`). Each user owns multiple boards; each board has customizable columns and rich cards (priority, due date, labels, assignee), plus search/filter and an AI assistant scoped to the active board.

## Commands

### Backend (run from project root)

```bash
uvicorn backend.main:app --reload   # dev server on :8000
```

### Backend tests (run from `backend/`)

```bash
pytest                   # all 34 backend tests
pytest test_main.py      # auth + AI proxy tests
pytest test_board.py     # card CRUD + metadata tests
pytest test_users.py     # registration / password hashing / data isolation
pytest test_boards.py    # multi-board CRUD + ownership
pytest test_sharing.py   # board collaboration + access control
pytest -k test_name      # single test by name
```

### Frontend (run from `frontend/`)

```bash
npm run dev              # Next.js dev server (http://localhost:3000)
npm run build            # static export → frontend/out/
npm run lint             # ESLint
npm run test:unit        # Vitest unit tests (51 tests, one-shot)
npm run test:unit:watch  # Vitest watch mode
npm run test:e2e         # Playwright e2e (16 tests — builds frontend, starts backend on :8000)
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

**Auth:** Users live in a `users` table with PBKDF2-hashed passwords (`security.py`). Cookie-based sessions are stored in SQLite `sessions` keyed by `user_id`, with a 24-hour TTL. `AuthGate.tsx` checks `/api/auth-status` on mount and renders `Workspace`; unauthenticated users are redirected to `/login` (registration at `/register`). Register/login are rate-limited (5/min, 10/min per IP) via `slowapi`.

**Data model:** `users` (1) → (N) `boards`. Each board row stores its Kanban layout as a single JSON blob in the `kanban_json` column (`owner_id`, `name`, `position`). `db.py` provides `list_boards`, `create_board`, `get_board_kanban`, `update_board_kanban`, `get_or_create_default_board`, etc., using thread-local connections, and migrates the legacy single-board schema on startup. `/api/board` and `/api/cards` accept an optional `board_id` query param (defaulting to the user's first board) and enforce ownership.

**AI flow:** `ChatSidebar.tsx` → `POST /api/ai` (`{ prompt, board, board_id }`) → FastAPI proxies to OpenRouter (`openai/gpt-oss-120b:free`) → returns `{ response, kanbanUpdate }` → validated against `StructuredAIResponse` → valid updates are merged onto (not replaced) the resolved board and persisted.

**DnD:** Managed by `@dnd-kit` entirely on the frontend. `lib/kanban.ts` contains all board types (`BoardData`, `Card`, `Column`, `Priority`, `CardFilter`) and pure helpers (`moveCard`, `findColumnId`, `getCardPosition`, `createId`, `cardMatchesFilter`, `collectLabels`, `getBoardStats`, `isOverdue`).

## Backend module layout

`backend/main.py` was refactored from a 230-line monolith into focused modules:

| File | Purpose |
|---|---|
| `backend/main.py` | Thin app factory — wires lifespan, middleware, routers, static serving (also maps extensionless deep links to `<route>.html`) |
| `backend/config.py` | Env-var loading, constants, shared `slowapi` `Limiter` instance |
| `backend/security.py` | PBKDF2-SHA256 `hash_password` / `verify_password` (stdlib only) |
| `backend/models.py` | All Pydantic request/response models |
| `backend/db.py` | SQLite init + legacy migration, thread-local connections, user/board/session read/write, `DEFAULT_BOARD` |
| `backend/auth.py` | `/api/register`, `/api/login`, `/api/logout`, `/api/auth-status`; `get_current_user` / `require_user` dependencies |
| `backend/board.py` | `/api/boards` CRUD + `/api/boards/{id}/members` sharing; `/api/board` (GET/PUT) and `/api/cards` (POST/PATCH/DELETE) scoped to a board. Access = owner or member; rename/delete/share are owner-only |
| `backend/ai.py` | `/api/ai` OpenRouter proxy, message builder, JSON extractor, board merge logic |

**Import note:** `main.py` runs `sys.path.insert(0, os.path.dirname(__file__))` before any local imports so sibling modules resolve correctly from both the project root (`uvicorn backend.main:app`) and the `backend/` directory (`pytest`).

**Shared limiter:** The `slowapi` `Limiter` instance is defined once in `config.py` and used as both `@config.limiter.limit()` in `auth.py` and `app.state.limiter` in `main.py` — required for the middleware and decorator to share the same counter.

## Key Frontend Files

| File | Purpose |
|---|---|
| `frontend/src/components/AuthGate.tsx` | Checks `/api/auth-status`, then renders `Workspace` |
| `frontend/src/components/Workspace.tsx` | Shell: loads boards, active-board state, responsive sidebar + mobile drawer |
| `frontend/src/components/BoardSidebar.tsx` | Board list — switch / create / rename / delete + sign out |
| `frontend/src/components/KanbanBoard.tsx` | Board state, DnD context, filter/summary, column + card handlers |
| `frontend/src/components/KanbanColumn.tsx` / `KanbanCard.tsx` | Column (rename/delete) and card (badges, edit/remove) UI |
| `frontend/src/components/CardEditor.tsx` | Modal editor for title/description/priority/due date/labels/assignee |
| `frontend/src/components/FilterBar.tsx` | Search + priority + label filtering |
| `frontend/src/components/ChatSidebar.tsx` | Collapsible AI assistant panel, scoped to the active board |
| `frontend/src/lib/api.ts` | Typed API client (auth, boards CRUD, board/card ops) |
| `frontend/src/lib/kanban.ts` | Shared types and pure board-manipulation / filter / stats utilities |

## Testing Notes

- **Backend:** `conftest.py` provides a `client` fixture with a `tmp_path`-scoped SQLite DB (each test fully isolated, default user re-seeded) and disables the shared rate limiter so per-IP counters don't bleed across tests. Monkeypatching `requests.post` targets `ai.requests`, not `main.requests`.
- **Frontend unit:** Vitest with jsdom; `@` aliased to `src/`. Pure helpers in `lib/kanban.ts` are unit-tested directly; components mock `@/lib/api` or `fetch`.
- **E2E:** Playwright `globalSetup` builds the frontend (`npm run build`), copies `frontend/out/` to `backend/static/`, then Playwright boots the real FastAPI backend on port 8000. Tests run against `http://127.0.0.1:8000`. They share the seeded `user` account/default board, so the suite runs serially (`workers: 1`); `beforeEach` reseeds the default board via `PUT /api/board`.
