# Project Management MVP

A Kanban project management web app with a Next.js frontend and a FastAPI backend, built as part of a Udemy course on AI-assisted coding.

## Functionality

- User sign-in with configurable credentials (default `user` / `password`, overridable via env vars).
- Protected access — unauthenticated users are redirected to login.
- Kanban board with five fixed columns (Backlog → Discovery → In Progress → Review → Done).
- Cards can be created, renamed, moved between columns, and deleted.
- Board state persisted in a local SQLite database (`backend/pm.db`).
- AI assistant chat sidebar, powered by OpenRouter, that can read and update the board via structured outputs.
- Session tokens stored in SQLite with a 24-hour expiry.

## Architecture

```
pm/
├── backend/
│   ├── main.py        # App factory — wires middleware, routers, and static serving
│   ├── config.py      # Env-var loading, constants, shared rate-limiter
│   ├── models.py      # Pydantic request/response models
│   ├── db.py          # SQLite access (boards + sessions, thread-local connections)
│   ├── auth.py        # /api/login, /api/logout, /api/auth-status, session dep
│   ├── board.py       # /api/board (GET/PUT) and /api/cards (POST/PATCH/DELETE)
│   ├── ai.py          # /api/ai OpenRouter proxy with structured-output validation
│   ├── static/        # Built Next.js output (auto-populated by Docker / e2e setup)
│   └── pm.db          # SQLite database (auto-created on first start)
└── frontend/
    ├── src/
    │   ├── app/           # Next.js app router pages (login, board)
    │   ├── components/    # KanbanBoard, ChatSidebar, Card, Column UI components
    │   └── lib/           # kanban.ts (types, helpers), api.ts (fetch wrappers)
    └── tests/             # Playwright e2e tests
```

## Environment variables

Copy `.env.example` to `.env` (or set these in Docker / your shell):

| Variable | Default | Description |
|---|---|---|
| `OPENROUTER_API_KEY` | — | Required for AI features |
| `APP_USERNAME` | `user` | Login username |
| `APP_PASSWORD` | `password` | Login password |
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

**Backend unit tests** (8 tests):
```powershell
cd backend
py -m pytest -v
```

**Frontend unit tests** (7 tests):
```powershell
cd frontend
npm run test:unit
```

**End-to-end tests** (3 tests — Playwright builds the frontend, copies it to `backend/static/`, then starts the backend on port 8000):
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
| `POST` | `/api/login` | Authenticate (rate-limited: 10/min per IP) |
| `POST` | `/api/logout` | Clear session |
| `GET` | `/api/auth-status` | Check current session |
| `GET` | `/api/board` | Fetch board for authenticated user |
| `PUT` | `/api/board` | Replace board state (schema-validated) |
| `POST` | `/api/cards` | Create a card |
| `PATCH` | `/api/cards/{id}` | Update / move a card |
| `DELETE` | `/api/cards/{id}` | Delete a card |
| `POST` | `/api/ai` | Proxy prompt to OpenRouter; merges board updates |
