# High level steps for project

This document is the master plan. Each Part below contains concrete substeps, tests, and success criteria. The agent will mark substeps complete as work progresses. The goal for Part 1 is to produce a detailed implementation plan and a frontend AGENTS.md describing the current frontend code.
Part 1: Plan (deliverables)

- 1.1 Audit frontend code: list key files, components, tests, and how to run the frontend locally.
- 1.2 Create `frontend/AGENTS.md` describing the structure, responsibilities, and test coverage of the frontend.
- 1.3 Expand this PLAN.md: for each subsequent Part (2–10) add a checklist of substeps, owner (agent), estimated effort, and explicit success criteria and tests.
Success criteria (Part 1):

- The repo contains `frontend/AGENTS.md` with clear file/component mapping and run instructions.
- `docs/PLAN.md` contains substeps for Parts 2–10 with testable acceptance criteria.
- User responds with either Approved / Minor edits / Major changes.
Part 2: Scaffolding

- 2.1 Add a Dockerfile and docker-compose (if needed) to run both the FastAPI backend and the statically built frontend from one container.
- 2.2 Create a minimal FastAPI app in `backend/` exposing a health check and a sample API endpoint.
- 2.3 Add start/stop scripts in `scripts/` for Windows, macOS, and Linux.
Success criteria (Part 2):

- Container builds and starts; `GET /health` returns 200; static page served at `/`.

Part 3: Add in Frontend

- 3.1 Add an `npm` build step and ensure the build artifacts are copied to the backend container image. Use Next.js `output: "export"` instead of `next export` for version 16.
- 3.2 Confirm the demo Kanban displays at `/` when the container is running.
- 3.3 Add unit tests and simple integration tests for the frontend build pipeline.
Success criteria (Part 3): build artifacts served and frontend tests pass locally.

Part 4: Fake user sign-in

- 4.1 Implement a simple session cookie + server-side check that accepts `user`/`password`.
- 4.2 Protect `/` so unauthenticated users are redirected to the login page.
- 4.3 Add tests verifying login/logout flows and cookie/session behavior.
Success criteria (Part 4): login works, protected route enforced, tests pass.

Part 5: Database modeling

- 5.1 Propose schema: use SQLite with a `boards` table storing board JSON in a `kanban_json` column (TEXT) along with `user_id` and timestamps.
- 5.2 Document migration/initialization behavior: create DB file if missing.
- 5.3 Add a short rationale: JSON-in-SQLite for simplicity and acceptable performance in an MVP.
Success criteria (Part 5): documented schema in `docs/` and DB auto-created on backend start.

Part 6: Backend

- 6.1 Implement CRUD endpoints for boards and cards (GET/PUT for a user's board, POST for card create, PATCH for card update/move, DELETE for card delete).
- 6.2 Write unit tests for each endpoint using `pytest` and FastAPI TestClient.
Success criteria (Part 6): endpoints implemented and unit tests passing.

Part 7: Frontend + Backend

- 7.1 Replace local demo state with API calls to the backend.
- 7.2 Add optimistic UI updates where reasonable and handle network errors gracefully.
- 7.3 Add integration tests that exercise save/load flows.
Success criteria (Part 7): frontend persists board changes to backend and reloads them.

Part 8: AI connectivity

- 8.1 Implement a backend route that proxies requests to OpenRouter using the `OPENROUTER_API_KEY` from `.env`.
- 8.2 Add a simple health/test that sends a trivial prompt ("2+2") and verifies the response shape.
Success criteria (Part 8): backend can call OpenRouter and receive valid responses in tests (mocked in CI where needed).

Part 9: Structured Outputs

- 9.1 Standardize the AI request format: include board JSON, user question, and conversation history.
- 9.2 Define and document the Structured Output schema the AI should return (user text + optional kanban delta JSON).
- 9.3 Implement server-side validation of Structured Outputs before applying changes.
Success criteria (Part 9): AI responses parsed, validated, and optionally applied to the board in tests.

Part 10: AI Chat UI

- 10.1 Add a sidebar chat UI in the frontend that posts messages to the backend AI route and displays responses.
- 10.2 When Structured Output contains board updates, apply them and refresh the UI automatically.
- 10.3 Add end-to-end tests covering a sample chat flow that results in a board update.
Success criteria (Part 10): chat UI works, AI-driven updates apply correctly, end-to-end tests pass.

Notes and constraints

- Use `OPENROUTER_API_KEY` from `.env` for AI calls.
- Keep the MVP simple—favor JSON-in-SQLite for the Kanban store unless user requests a relational design.
- Include clear run instructions in both `frontend/AGENTS.md` and this document.
- Aim for roughly 80% test coverage only when it makes sense; prioritize valuable tests over meeting a metric. Missing 80% is acceptable if the tests are not adding real value.

Next action: implement Part 4, fake user sign-in, including server-side session checks and a protected login flow.
# High level steps for project

Part 1: Plan

Enrich this document to plan out each of these parts in detail, with substeps listed out as a checklist to be checked off by the agent, and with tests and success critieria for each. Also create an AGENTS.md file inside the frontend directory that describes the existing code there. Ensure the user checks and approves the plan.

Part 2: Scaffolding

Set up the Docker infrastructure, the backend in backend/ with FastAPI, and write the start and stop scripts in the scripts/ directory. This should serve example static HTML to confirm that a 'hello world' example works running locally and also make an API call.

Part 3: Add in Frontend

Now update so that the frontend is statically built and served, so that the app has the demo Kanban board displayed at /. Comprehensive unit and integration tests.

Part 4: Add in a fake user sign in experience

Now update so that on first hitting /, you need to log in with dummy credentials ("user", "password") in order to see the Kanban, and you can log out. Comprehensive tests.

Part 5: Database modeling

Now propose a database schema for the Kanban, saving it as JSON. Document the database approach in docs/ and get user sign off.

Part 6: Backend

Now add API routes to allow the backend to read and change the Kanban for a given user; test this thoroughly with backend unit tests. The database should be created if it doesn't exist.

Part 7: Frontend + Backend

Now have the frontend actually use the backend API, so that the app is a proper persistent Kanban board. Test very throughly.

Part 8: AI connectivity

Now allow the backend to make an AI call via OpenRouter. Test connectivity with a simple "2+2" test and ensure the AI call is working.

Part 9: Now extend the backend call so that it always calls the AI with the JSON of the Kanban board, plus the user's question (and conversation history). The AI should respond with Structured Outputs that includes the response to the user and optionaly an update to the Kanban. Test thoroughly.

Part 10: Now add a beautiful sidebar widget to the UI supporting full AI chat, and allowing the LLM (as it determines) to update the Kanban based on its Structured Outputs. If the AI updates the Kanban, then the UI should refresh automatically.