# Project Management App

A multi-user Kanban project management web app with a Next.js frontend and a FastAPI backend, built as part of a Udemy course on AI-assisted coding.

## Functionality

- **User accounts** — self-service registration, login, and password change, with PBKDF2-hashed passwords. A default `user` / `password` account is seeded (credentials configurable via env vars).
- **Per-user data isolation** — each user only sees their own boards and cards.
- **Multiple boards per user** — create, rename, switch, and delete boards from the workspace sidebar.
- **Board collaboration** — owners can share a board with other users by username; collaborators (editors) can view and edit but cannot rename, delete, or re-share. Access is enforced server-side.
- **Card comments** — board members can discuss a card via a comment thread (author + timestamp set server-side); a count badge shows on the card.
- **Activity log** — each board records recent events (cards added/deleted, comments, sharing) with actor + timestamp, viewable in an Activity panel.
- **Customizable columns** — add and remove columns per board (defaults: Backlog → Discovery → In Progress → Review → Done).
- **Rich cards** — title, description, priority (low/medium/high), due date (with overdue highlighting), labels, and an assignee. Cards are created, edited (modal), moved via drag-and-drop, and deleted.
- **Search & filter** — filter visible cards by text, priority, and label; a board summary shows total / done / overdue counts.
- **AI assistant** — chat sidebar powered by OpenRouter that can read and update the active board via validated structured outputs.
- **Responsive UI** — sidebar collapses to a drawer on mobile; the board scrolls horizontally with touch drag support.
- **Dark mode** — theme toggle that persists to `localStorage` and respects the OS `prefers-color-scheme`, applied before first paint (no flash); built on CSS-variable design tokens.
- Board state persisted in SQLite (`backend/pm.db`); session tokens stored with a 24-hour expiry.

## Architecture

```
pm/
├── backend/
│   ├── main.py        # App factory — middleware, routers, SPA/static serving
│   ├── config.py      # Env-var loading, constants, shared rate-limiter
│   ├── security.py    # PBKDF2 password hashing (stdlib)
│   ├── models.py      # Pydantic request/response models
│   ├── db.py          # SQLite access (users, boards-per-user, sessions) + migration
│   ├── auth.py        # /api/register, /api/login, /api/logout, /api/auth-status
│   ├── board.py       # /api/boards CRUD; /api/board + /api/cards scoped to a board
│   ├── ai.py          # /api/ai OpenRouter proxy with structured-output validation
│   ├── static/        # Built Next.js output (auto-populated by Docker / e2e setup)
│   └── pm.db          # SQLite database (auto-created on first start)
└── frontend/
    ├── src/
    │   ├── app/           # Next.js pages (login, register, board)
    │   ├── components/    # Workspace, BoardSidebar, KanbanBoard, KanbanColumn,
    │   │                  # KanbanCard, CardEditor, FilterBar, ChatSidebar, …
    │   └── lib/           # kanban.ts (types/helpers), api.ts (typed API client)
    └── tests/             # Playwright e2e tests
```

Data model: `users` (1) → (N) `boards`; each board stores its Kanban layout as a JSON blob. `sessions` reference `user_id`. A legacy single-board schema is migrated automatically on startup.

## Environment variables

Copy `.env.example` to `.env` (or set these in Docker / your shell):

| Variable | Default | Description |
|---|---|---|
| `OPENROUTER_API_KEY` | — | Required for AI features |
| `APP_USERNAME` | `user` | Seeded default account username |
| `APP_PASSWORD` | `password` | Seeded default account password |
| `COOKIE_SECURE` | `false` | Set to `true` behind HTTPS |

## Run locally

**Backend** (from project root):
```powershell
pip install -r backend/requirements.txt
py -m uvicorn backend.main:app --port 8000 --reload
```

**Frontend dev server** (separate terminal, during development only):
```powershell
cd frontend
npm install
npm run dev        # http://localhost:3000
```

## Run tests

**Backend tests** (33 tests):
```powershell
cd backend
py -m pytest -v
```

**Frontend unit tests** (49 tests):
```powershell
cd frontend
npm run test:unit
```

**End-to-end tests** (15 tests — Playwright builds the frontend, copies it to `backend/static/`, then starts the backend on port 8000; runs serially against the shared dev DB):
```powershell
cd frontend
npx playwright test
```

## Run with Docker

```powershell
docker compose up --build -d
```

Open `http://localhost:8000`. To stop:

```powershell
docker compose down
```

The Docker build compiles the frontend, copies the static output to `backend/static/`, and starts uvicorn. Both the API and the static site are served from port 8000.

## Key API endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `POST` | `/api/register` | Create an account + session (rate-limited: 5/min per IP) |
| `POST` | `/api/login` | Authenticate (rate-limited: 10/min per IP) |
| `POST` | `/api/logout` | Clear session |
| `GET` | `/api/auth-status` | Check current session |
| `POST` | `/api/account/password` | Change the signed-in user's password |
| `GET` | `/api/boards` | List the user's boards |
| `POST` | `/api/boards` | Create a board |
| `PATCH` | `/api/boards/{id}` | Rename a board |
| `DELETE` | `/api/boards/{id}` | Delete a board (owner only) |
| `GET` | `/api/boards/{id}/members` | List a board's owner + collaborators |
| `POST` | `/api/boards/{id}/members` | Share with a user by username (owner only) |
| `DELETE` | `/api/boards/{id}/members/{userId}` | Revoke a collaborator (owner only) |
| `GET` | `/api/board?board_id=` | Fetch a board's Kanban (defaults to the user's first board) |
| `PUT` | `/api/board?board_id=` | Replace board state (schema-validated) |
| `POST` | `/api/cards?board_id=` | Create a card |
| `PATCH` | `/api/cards/{id}?board_id=` | Update / move a card |
| `DELETE` | `/api/cards/{id}?board_id=` | Delete a card |
| `POST` | `/api/cards/{id}/comments?board_id=` | Add a comment (author/timestamp set server-side) |
| `GET` | `/api/boards/{id}/activity` | Recent board activity (members only) |
| `POST` | `/api/ai` | Proxy prompt to OpenRouter; merges board updates |

Board/card endpoints enforce ownership — accessing another user's board returns `404`.
