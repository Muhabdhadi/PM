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
- [x] **Phase 3 — PM card features**: labels, priority, due dates, rich description
      via a card editor modal. Backend models + endpoints + frontend editor. Tests.
- [ ] **Phase 4 — UI overhaul + mobile responsive**: design system pass, responsive
      layout (mobile column scroll, drawer nav), accessible components. e2e mobile viewport.
- [~] **Phase 5 — Polish**: search/filter + board summary DONE; AI already scoped to
      active board (Phase 1/2). Remaining: activity log, docs refresh.

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
- Completed Phase 3 richer cards:
  - Backend: KanbanCard/CardCreate/CardUpdate gain `priority` (low/medium/high),
    `dueDate`, `labels`; create/update persist them; update can clear them.
  - Frontend: `kanban.ts` Card type + priority styles + `isOverdue`; KanbanCard
    renders priority/due/label badges + Edit button; `CardEditor` modal (title,
    description, priority, due date, labels, delete); NewCardForm gains priority +
    due date; KanbanBoard `handleUpdateCard` (optimistic + revert).
  - Tests: backend card-metadata + invalid-priority; CardEditor (3), NewCardForm (2),
    isOverdue (2) unit tests; e2e card-edit. Made e2e serial (workers:1) to avoid
    shared-DB contention; removed dnd `attributes` (role=button) that broke buttons.
    21 backend + 22 frontend unit + 8 e2e all green.
- Next: Phase 4 — UI overhaul polish & accessibility; Phase 5 — search/filter + AI scoping.

### Iteration 2
- Phase 5 (search/filter + summary):
  - `kanban.ts`: `CardFilter`, `cardMatchesFilter`, `collectLabels`, `getBoardStats`,
    `isFilterActive`, `emptyFilter`.
  - `FilterBar` component (search text + priority + label + clear).
  - `KanbanBoard`: filter state, board summary chips (total/done/overdue), filtered
    column rendering; `KanbanColumn` SortableContext now derives from visible cards.
  - Tests: kanban filter/stat unit tests, FilterBar unit tests, e2e search filter.
    21 backend + 31 frontend unit + 9 e2e all green.
- Custom columns: add/remove columns (delete enabled only for empty, non-last
  columns); board switched to a scalable horizontal flex layout (Trello-style)
  so arbitrary column counts work on every breakpoint. e2e add/remove column.
  21 backend + 31 frontend unit + 10 e2e all green.
- Next: Phase 4 UI/accessibility polish; then activity log + docs refresh.

### Iteration 3
- Assignee field on cards (backend model + create/update; CardEditor field; card
  avatar chip; optimistic update). Mirrors the priority/labels pattern.
- Accessibility: CardEditor closes on Escape (unit + covered in flows).
- Docs refresh: README.md and CLAUDE.md rewritten to reflect multi-user,
  multi-board architecture, new endpoints, modules, components, and test counts.
- 21 backend + 32 frontend unit + 10 e2e all green.
- Next: board collaboration/sharing (own iteration), activity log, further a11y.

### Iteration 4
- Board collaboration / sharing:
  - DB: `board_members` table; `list_accessible_boards`, `user_can_access_board`,
    `add_board_member`, `remove_board_member`, `list_board_members`.
  - API: `GET/POST /api/boards/{id}/members`, `DELETE .../members/{user_id}`.
    Access = owner or member; rename/delete/share owner-only (404 otherwise).
  - Frontend: `ShareDialog` (list/invite/remove); `BoardSidebar` shows shared
    boards ("shared by X"), hides owner-only actions, adds a Share button;
    `Workspace` wires the dialog; `api.ts` member helpers + role/owner fields.
  - Tests: `test_sharing.py` (4 access-control tests); ShareDialog (4) +
    BoardSidebar shared-behavior (2) unit tests; collaboration e2e (invite+revoke).
  - Docs (README + CLAUDE) updated. 25 backend + 38 frontend unit + 11 e2e green.
- Next: activity log; further a11y/UX polish.

### Iteration 6
- Activity log:
  - DB: `board_activity` table; `record_activity` + `list_activity`.
  - Recorded on card add/delete, comment add, member add/remove (actor +
    server timestamp). `GET /api/boards/{id}/activity` (members only).
  - Frontend: `ActivityDialog` (read-only feed, ESC close); Activity button in
    the board summary row; `api.listActivity`.
  - Tests: test_activity.py (3 — events, sharing, access); ActivityDialog unit
    tests (2); e2e (add card → see activity, waiting on the create response to
    avoid the optimistic-write race). 32 backend + 42 frontend unit + 13 e2e green.
- Next: further a11y/UX polish (focus management, empty states, dark mode?).

### Iteration 7 (UI/UX)
- Dark mode: `html.dark` CSS-variable overrides; converted hardcoded `bg-white`/
  slate colors across components + login/register to design tokens; `ThemeToggle`
  (persists to localStorage, aria-pressed) in the sidebar; no-FOUC init script in
  layout that also respects `prefers-color-scheme`. Global `:focus-visible` ring.
- Fixed a latent e2e flakiness bug: the real server's per-IP rate limiter tripped
  on the serial suite's repeated logins (429 → redirect to /login). Added
  `DISABLE_RATE_LIMIT` env (config.limiter `enabled`) and set it in Playwright's
  webServer. 32 backend + 44 frontend unit + 14 e2e green.
- Next: empty states, loading skeletons, modal focus management.

### Iteration 5
- Card comments (collaboration):
  - Backend: `comments` on KanbanCard; `POST /api/cards/{id}/comments` appends
    `{id, author, text, createdAt}` (author/time server-set), accessible to any
    board member. Fixed a null-`comments` crash (PUT serializes it to null) and
    added a regression test for that path.
  - Frontend: comment thread + input in CardEditor (`onAddComment`), comment-count
    badge on cards, `api.addComment`, optimistic board update.
  - Tests: backend comment append/author/access/null-path (4) + member-comment
    sharing test; CardEditor comment unit tests (2); e2e add-comment.
  - Docs updated. 29 backend + 40 frontend unit + 12 e2e green.
- Next: activity log; further a11y/UX polish.
