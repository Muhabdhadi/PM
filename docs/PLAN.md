# High level steps for project

This document is the master plan. Each Part below contains concrete substeps, tests, and success criteria. The agent will mark substeps complete as work progresses.

## Current status

- [x] Part 1: Plan
- [x] Part 2: Scaffolding
- [x] Part 3: Add Frontend
- [x] Part 4: Fake user sign-in
- [x] Part 5: Database modeling
- [x] Part 6: Backend
- [x] Part 7: Frontend + Backend
- [x] Part 8: AI connectivity
- [x] Part 9: Structured Outputs
- [x] Part 10: AI Chat UI

## Part 1: Plan (deliverables)

- [x] 1.1 Audit frontend code: list key files, components, tests, and how to run the frontend locally.
- [x] 1.2 Create `frontend/AGENTS.md` describing the structure, responsibilities, and test coverage of the frontend.
- [x] 1.3 Expand this `docs/PLAN.md`: for each subsequent Part (2–10) add a checklist of substeps, explicit success criteria, and tests.

Success criteria (Part 1):

- [x] The repo contains `frontend/AGENTS.md` with clear file/component mapping and run instructions.
- [x] `docs/PLAN.md` contains substeps for Parts 2–10 with testable acceptance criteria.
- [x] User reviews and approves the plan.

## Part 2: Scaffolding

- [x] 2.1 Add a Dockerfile and docker-compose (if needed) to run both the FastAPI backend and the statically built frontend from one container.
- [x] 2.2 Create a minimal FastAPI app in `backend/` exposing a health check and a sample API endpoint.
- [x] 2.3 Add start/stop scripts in `scripts/` for Windows, macOS, and Linux.

Success criteria (Part 2):

- [x] Container builds and starts successfully.
- [x] `GET /health` returns 200.
- [x] Static page is served at `/`.

## Part 3: Add in Frontend

- [x] 3.1 Add an `npm` build step and ensure build artifacts are copied to the backend container image. Use Next.js `output: "export"` instead of `next export` for version 16.
- [x] 3.2 Confirm the demo Kanban displays at `/` when the container is running.
- [x] 3.3 Add unit tests and simple integration tests for the frontend build pipeline.

Success criteria (Part 3):

- [x] Build artifacts are served from the backend.
- [x] Frontend tests pass locally.

## Part 4: Fake user sign-in

- [x] 4.1 Implement a simple session cookie + server-side check that accepts `user`/`password`.
- [x] 4.2 Protect `/` so unauthenticated users are redirected to the login page.
- [x] 4.3 Add tests verifying login/logout flows and cookie/session behavior.

Success criteria (Part 4):

- [x] Login works.
- [x] Protected route is enforced.
- [x] Tests pass.

## Part 5: Database modeling

- [x] 5.1 Propose schema: use SQLite with a `boards` table storing board JSON in a `kanban_json` column (TEXT) along with `user_id` and timestamps.
- [x] 5.2 Document migration/initialization behavior: create DB file if missing.
- [x] 5.3 Add a short rationale: JSON-in-SQLite for simplicity and acceptable performance in an MVP.

Success criteria (Part 5):

- [x] Schema documented in `docs/`.
- [x] DB auto-creates on backend start.

Schema details (implemented):

- Database file: `backend/pm.db` (auto-created on first start)
- Table: `boards`
  - `id` INTEGER PRIMARY KEY AUTOINCREMENT
  - `user_id` TEXT UNIQUE NOT NULL
  - `kanban_json` TEXT NOT NULL
  - `created_at` TEXT NOT NULL (ISO timestamp)
  - `updated_at` TEXT NOT NULL (ISO timestamp)

Rationale: storing the full board JSON in a single TEXT column keeps the MVP simple, avoids early normalization, and is easy to validate and persist.

## Part 6: Backend

- [x] 6.1 Implement CRUD endpoints for boards and cards (GET/PUT for a user's board, POST for card create, PATCH for card update/move, DELETE for card delete).
- [x] 6.2 Write unit tests for each endpoint using `pytest` and FastAPI TestClient.

Success criteria (Part 6):

- [x] Endpoints implemented.
- [x] Backend unit tests pass.

## Part 7: Frontend + Backend

- [x] 7.1 Replace local demo state with API calls to the backend.
- [x] 7.2 Add optimistic UI updates where reasonable and handle network errors gracefully.
- [x] 7.3 Add integration tests that exercise save/load flows.

Success criteria (Part 7):

- [x] Frontend persists board changes to backend.
- [x] Board state reloads correctly.

## Part 8: AI connectivity

- [x] 8.1 Implement a backend route that proxies requests to OpenRouter using the `OPENROUTER_API_KEY` from `.env`.
- [x] 8.2 Add a simple live test that sends a trivial prompt (`"2+2"`) and verifies the response shape.

Success criteria (Part 8):

- [x] Backend can call OpenRouter live.
- [x] Tests verify the AI proxy works with a valid response.

## Part 9: Structured Outputs

- [x] 9.1 Standardize the AI request format: include board JSON, user question, and conversation history.
- [x] 9.2 Define and document the Structured Output schema the AI should return (user text + optional kanban delta JSON).
- [x] 9.3 Implement server-side validation of Structured Outputs before applying changes.

Success criteria (Part 9):

- [x] AI responses parsed and validated.
- [x] Board updates are applied only when the output passes validation.

## Part 10: AI Chat UI

- [x] 10.1 Add a sidebar chat UI in the frontend that posts messages to the backend AI route and displays responses.
- [x] 10.2 When Structured Output contains board updates, apply them and refresh the UI automatically.
- [x] 10.3 Add end-to-end tests covering a sample chat flow that results in a board update.

Success criteria (Part 10):

- [x] Chat UI works.
- [x] AI-driven updates apply correctly.
- [x] End-to-end tests pass.

## Post-MVP: Code Review and Hardening

Completed after Part 10. A comprehensive code review was written to `docs/CODE_REVIEW.md` covering 3 critical, 4 high, 8 medium, and 8 low severity findings. All 23 findings were remediated and all tests re-run to confirm.

### Security fixes
- [x] C-1 — API key removed from version control; `.env` confirmed in `.gitignore`
- [x] C-2 — Credentials loaded from env vars (`APP_USERNAME`, `APP_PASSWORD`); `secrets.compare_digest` used for constant-time comparison
- [x] C-3 — Sessions moved from in-memory dict to SQLite `sessions` table with 24-hour TTL
- [x] M-1 — Rate limiting on `/api/login` via `slowapi` (10 requests/min per IP)
- [x] M-2 — Session cookie hardened: `httponly=True`, `secure` from env, `samesite="strict"`
- [x] H-1 — `AIRequest` fields bounded: `prompt` max 2 000 chars, `history` max 50 items; board JSON truncated to 8 000 chars

### Correctness fixes
- [x] H-2 — Removed incompatible `rewrites()` from `next.config.ts` (static export mode)
- [x] H-3 — Fixed `httpx2` typo → `httpx` in `requirements.txt`
- [x] H-4 — Replaced shallow `dict.copy()` with `copy.deepcopy()` for `DEFAULT_BOARD`
- [x] M-4 — `PUT /api/board` now validates body against `KanbanUpdate` Pydantic model
- [x] M-7 — AI board update merges onto existing board rather than replacing it

### Robustness / maintainability fixes
- [x] M-3 — Frontend API mutations revert optimistic state on failure and log errors
- [x] M-5 — Sessions include `expires_at`; tokens older than 24 hours are rejected
- [x] M-6 — Thread-local SQLite connections replace per-request `connect()` calls
- [x] M-8 — `ChatSidebar` props typed with `BoardData` instead of `any`
- [x] L-1 — `createId()` uses `crypto.randomUUID()` instead of `Math.random()`
- [x] L-2 — `@app.on_event("startup")` replaced with `lifespan` context manager
- [x] L-3 — `datetime.utcnow()` replaced with `datetime.now(timezone.utc)`
- [x] L-5 — Duplicate condition in `KanbanBoard.test.tsx` fetch mock fixed
- [x] L-6 — `position` field validated with `ge=0` in `CardUpdate`
- [x] L-7 — `CardCreate.title` and `details` bounded with `min_length` / `max_length`

### Testing improvements
- [x] L-4 — `conftest.py` added: each test gets an isolated SQLite DB via `tmp_path`; `TestClient` provided as a fixture
- [x] L-8 — E2E tests moved to port 8000; `globalSetup` builds frontend and copies to `backend/static/`; Playwright boots the real backend

## Post-MVP: Backend Refactoring

Completed after the code-review hardening. `backend/main.py` (previously ~230 lines handling everything) was split into focused modules:

- [x] `config.py` — env-var loading, constants, shared `slowapi` `Limiter` instance
- [x] `models.py` — all Pydantic request/response models
- [x] `auth.py` — auth router + `get_username_from_session` FastAPI dependency
- [x] `board.py` — board router and card CRUD endpoints
- [x] `ai.py` — AI proxy router, message builder, JSON extractor
- [x] `main.py` — thin app factory: creates `FastAPI`, registers middleware, mounts routers, serves static files (~45 lines)

All 18 tests (8 backend + 7 unit + 3 e2e) pass after the refactor.

## Notes and constraints

- Use `OPENROUTER_API_KEY` from `.env` for AI calls.
- Keep the MVP simple—favor JSON-in-SQLite for the Kanban store unless user requests a relational design.
- Include clear run instructions in both `frontend/AGENTS.md` and this document.
- Aim for roughly 80% test coverage only when it makes sense; prioritize valuable tests over meeting a metric. Missing 80% is acceptable if the tests are not adding real value.
