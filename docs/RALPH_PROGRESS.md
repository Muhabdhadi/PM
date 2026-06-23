# Ralph Loop Progress — Comprehensive PM App

Task: Add user management, multiple kanban boards per user, more PM features,
overhaul + mobile-responsive UI, strong test coverage & integration tests.

## Roadmap (phased so each iteration ends green & committed)

- [x] **Phase 1 — Backend foundation**: users table + hashed passwords + registration;
      multiple boards per user; board CRUD endpoints; cards scoped to a board.
      Backward-compatible defaults keep `/api/board` + `/api/cards` working on a
      per-user default board. Full backend test coverage (19 tests).
- [x] **Phase 2 — Frontend auth & boards**: registration page, boards list / switcher,
      create/rename/delete boards, wire to new API. Unit + e2e tests.
- [ ] **Phase 3 — PM card features**: labels, priority, due dates, assignee/description.
      Backend models + endpoints + frontend card editor. Tests.
- [ ] **Phase 4 — UI overhaul + mobile responsive**: design system pass, responsive
      layout (mobile column scroll, drawer nav), accessible components. e2e mobile viewport.
- [ ] **Phase 5 — Polish**: search/filter, activity, AI scoped to active board, docs.

## Status log

### Iteration 1
- Reviewed full codebase (backend modules + frontend components + tests).
- Completed Phase 1 backend foundation:
  - `security.py`: PBKDF2 password hashing (stdlib).
  - `db.py`: new schema (users / boards-per-user / sessions-by-user), legacy
    migration, default-user + default-board seeding.
  - `auth.py`: `/api/register`, DB-backed login, `get_current_user`/`require_user`.
  - `board.py`: `/api/boards` CRUD; cards & `/api/board` scoped to a board with
    default-board fallback + ownership checks.
  - `ai.py`: scoped to resolved board.
  - Tests: `test_users.py`, `test_boards.py` added; limiter disabled in tests.
    19 backend + 7 frontend unit tests green.
- Completed Phase 2 frontend auth & multi-board workspace:
  - `lib/api.ts`: typed client for auth, boards CRUD, board/card ops (board_id aware).
  - `Workspace.tsx` shell: responsive sidebar + mobile drawer, active-board state.
  - `BoardSidebar.tsx`: list / switch / create / rename / delete boards + sign out.
  - `KanbanBoard.tsx`: takes `boardId`, uses api helpers, touch sensor + mobile
    horizontal column scroll; `ChatSidebar` now collapsible + board-scoped.
  - `/register` page + login page register link; `AuthGate` renders Workspace.
  - `main.py`: serve `<route>.html` for extensionless deep links (fixes /register).
  - Tests: BoardSidebar (6) + Workspace (2) unit tests; e2e create-board, register,
    redirect specs. 19 backend + 15 frontend unit + 7 e2e all green.
- Next: Phase 3 — richer card features (labels, priority, due date, description editor).
