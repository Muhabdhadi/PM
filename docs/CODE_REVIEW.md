# Code Review: Kanban Project Management MVP

**Date:** 2026-06-19
**Scope:** Full codebase — backend (FastAPI/Python), frontend (Next.js/TypeScript), infrastructure (Docker)

---

## Executive Summary

The codebase is well-structured and readable for an MVP learning project. The test scaffold covers the happy path adequately. However there are **three critical and four high severity issues** that must be addressed before any public or shared deployment: a committed API key, hard-coded plaintext credentials, in-memory session storage that is not multi-worker safe, an unbounded AI prompt injection surface, a broken Next.js configuration, a missing Python package, and a shallow-copy bug that corrupts shared state across requests. Below those sit a cluster of medium issues (no rate limiting, silent fire-and-forget mutations, unvalidated PUT body, missing cookie flags) and several low/maintainability items.

---

## CRITICAL

### C-1 — API Key Committed to Version Control

**Category:** Security
**File:** `.env`, line 1

The `.env` file contains a live OpenRouter API key and may be tracked by git. The `.gitignore` lists `.env`, but the file may have been committed before that entry existed. Any push to a public or shared repository permanently exposes this secret.

**Fix:**
1. Rotate the key immediately at openrouter.ai.
2. Confirm `.env` is in `.gitignore` and run `git rm --cached .env` so it is no longer tracked.
3. Inject the key exclusively via environment variables — the `docker-compose.yml` already reads `${OPENROUTER_API_KEY}` from the host environment.

---

### C-2 — Hard-Coded Plaintext Credentials in Source Code

**Category:** Security
**Files:** `backend/main.py:20-21`, `backend/test_main.py:23-24`, `frontend/src/app/login/page.tsx:7,87-90`

```python
VALID_USERNAME = "user"
VALID_PASSWORD = "password"
```

The single shared password is stored in plaintext in source code and is also displayed on screen in the login UI as "demo credentials". Any fork, screenshot, or log line leaks working credentials permanently. There is no hashing, no salt, and no path to changing the password without a code deploy.

**Fix:**
Load credentials from environment variables and hash-compare the password:
```python
VALID_USERNAME = os.environ["APP_USERNAME"]
VALID_PASSWORD_HASH = os.environ["APP_PASSWORD_HASH"]  # pre-computed bcrypt hash
# comparison: passlib.hash.bcrypt.verify(supplied_password, VALID_PASSWORD_HASH)
```
Remove the on-screen credential hint from `login/page.tsx` for anything beyond a local demo.

---

### C-3 — In-Process Session Store Lost on Restart / Not Multi-Worker Safe

**Category:** Security / Correctness
**File:** `backend/main.py:23`

```python
sessions: dict[str, str] = {}
```

Sessions live only in the Python interpreter's heap. Every container restart or uvicorn worker reload invalidates all active sessions, silently logging every user out. If uvicorn runs with `--workers > 1`, each worker owns its own `sessions` dict — tokens issued by worker A are invisible to worker B, making `(N-1)/N` of auth checks fail non-deterministically.

**Fix:**
Store sessions in a `sessions` table in `pm.db` alongside `user_id` and `created_at`. This is the simplest durable fix that matches the existing SQLite infrastructure.

---

## HIGH

### H-1 — AI Prompt Injection / Unbounded Payload Size

**Category:** Security
**File:** `backend/main.py:104-107,183-246`

The `/api/ai` endpoint accepts `prompt`, `board`, and `history` from the client with no length validation. A malicious or buggy client can send an arbitrarily large payload to exhaust the account's token quota in one request, or inject adversarial instructions into `prompt` that override the system prompt. The `max_tokens: 250` response limit does not constrain input size.

**Fix:**
Add field-level validators to `AIRequest`:
```python
class AIRequest(BaseModel):
    prompt: str = Field(..., max_length=2000)
    board: dict | None = None
    history: list[dict] | None = Field(default=None, max_length=50)
```
Truncate `board` JSON to a token budget (e.g., 8 000 chars) before injecting it into the system message.

---

### H-2 — `next.config.ts`: `output: "export"` Is Incompatible with `rewrites()`

**Category:** Correctness
**File:** `frontend/next.config.ts:3-13`

Next.js `output: "export"` generates a fully static site and explicitly does not support `rewrites()`. Next.js silently ignores the `rewrites()` function in export mode. In `npm run dev` the dev server correctly proxies `/api/*` to `http://localhost:8000` (masking the problem), but the exported static site has no proxy — API calls only work because FastAPI serves the static files on the same origin.

This is the correct production behaviour for the Docker setup, but the `rewrites()` block is dead code that creates confusion and is logged as a warning at startup.

**Fix — pick one:**
- **Option A (recommended — keep static export):** Remove `rewrites()` entirely. The Docker setup already serves both static files and the API on the same origin, so no proxy is needed.
- **Option B (keep the dev proxy):** Remove `output: "export"` and run Next.js in server mode, updating the Dockerfile accordingly.

---

### H-3 — `httpx2` Is Not a Real PyPI Package

**Category:** Correctness
**File:** `backend/requirements.txt:6`

`httpx2` does not exist on PyPI. The real async HTTP library that FastAPI's `TestClient` depends on is `httpx`. Installing `httpx2` will either fail at install time or install an unrelated package, breaking the test suite.

**Fix:**
Replace `httpx2` with `httpx` (e.g., `httpx>=0.27`).

---

### H-4 — Shallow Copy of `DEFAULT_BOARD` Allows Mutation Across Requests

**Category:** Correctness
**File:** `backend/main.py:282`

```python
return DEFAULT_BOARD.copy()
```

`dict.copy()` is a shallow copy. `DEFAULT_BOARD["columns"]` is a list of dicts — `copy()` copies the reference to that list, not the list itself. Any code that mutates `board["columns"]` (e.g., `col["cardIds"].append(card_id)` in `create_card`) also mutates the original `DEFAULT_BOARD` module-level constant. Subsequent new users will receive a contaminated default board.

**Fix:**
```python
import copy
return copy.deepcopy(DEFAULT_BOARD)
```

---

## MEDIUM

### M-1 — No Rate Limiting on Login Endpoint

**Category:** Security
**File:** `backend/main.py:74`

There is no rate limiting, account lockout, or CAPTCHA on `/api/login`. The endpoint accepts unlimited attempts, making brute-force trivial.

**Fix:**
Add `slowapi` with a limit of ~10 attempts per IP per minute:
```python
from slowapi import Limiter
limiter = Limiter(key_func=get_remote_address)

@app.post("/api/login")
@limiter.limit("10/minute")
def login(...): ...
```

---

### M-2 — Session Cookie Missing `secure=True` Flag

**Category:** Security
**File:** `backend/main.py:81-87`

The session cookie is set with `httponly=True` and `samesite="lax"` but without `secure=True`. Without it the cookie can be transmitted over plain HTTP.

**Fix:**
```python
response.set_cookie(..., httponly=True, secure=True, samesite="strict")
```
Apply the same flags to `delete_cookie()` on logout.

---

### M-3 — Fire-and-Forget API Mutations Silently Desync Board State

**Category:** Robustness
**File:** `frontend/src/components/KanbanBoard.tsx:47-54,76-83,117-124,144-147`

All mutating API calls (card create, move, delete, board save) swallow errors silently. If the backend is down or returns an error, the UI shows the mutation as successful while the server state diverges. On the next page load, the user sees their changes rolled back with no explanation.

**Fix:**
At minimum, revert the optimistic UI state on failure and surface an error message:
```ts
.catch((err) => {
  console.error("Failed to persist change:", err);
  setBoard(previousState); // revert optimistic update
});
```

---

### M-4 — `PUT /api/board` Accepts Arbitrary JSON Without Schema Validation

**Category:** Security / Robustness
**File:** `backend/main.py:60-66`

```python
def put_board(payload: dict, ...):
    db.upsert_board(username, payload)
```

`payload` is typed as a raw `dict` with no schema enforcement. A client can store arbitrary structures, oversized arrays, or unexpected keys directly in the database. The `KanbanUpdate` Pydantic model already exists in the file and should be reused here.

**Fix:**
```python
def put_board(payload: KanbanUpdate, ...):
    db.upsert_board(username, payload.model_dump())
```

---

### M-5 — No Session Expiry or Token Rotation

**Category:** Security
**File:** `backend/main.py:23,79`

Session tokens never expire. A stolen token is valid until the server restarts or the user explicitly logs out. Logging in twice creates two simultaneously valid tokens with no mechanism to invalidate the older one.

**Fix:**
Store a `created_at` timestamp with each session and reject tokens older than 24 hours. Invalidate any existing token for the user on new login.

---

### M-6 — New SQLite Connection Opened Per Request

**Category:** Performance / Robustness
**File:** `backend/db.py:9-13,48-66`

Every `get_board` and `upsert_board` call creates and closes a new `sqlite3.connect()`. The `check_same_thread=False` flag is set but has no effect since each call creates its own connection rather than sharing one.

**Fix:**
Use a `threading.local()` connection per thread, or move to SQLAlchemy with a connection pool. For this MVP, a simple module-level connection with locking is sufficient.

---

### M-7 — AI Board Update Replaces Entire Board Instead of Merging

**Category:** Correctness
**File:** `backend/main.py:241-244`, `frontend/src/components/ChatSidebar.tsx:29-33`

When the AI returns a `kanbanUpdate`, the backend calls `db.upsert_board()` with only what the AI returned. If the AI returns a partial update (likely given the 250-token output limit), all other columns and cards are destroyed.

**Fix:**
Merge the AI's changes onto the existing board state rather than replacing it, or instruct the AI in the system prompt to always return the complete board JSON.

---

### M-8 — `ChatSidebar` Uses `any` Type for Core Props

**Category:** Maintainability
**File:** `frontend/src/components/ChatSidebar.tsx:7`

```ts
{ board: any; onApplyBoard: (b: any) => void }
```

Both `board` and the callback parameter are typed as `any`, losing all TypeScript type safety for the most data-intensive component in the app.

**Fix:**
```ts
import type { BoardData } from "@/lib/kanban";
function ChatSidebar({ board, onApplyBoard }: { board: BoardData; onApplyBoard: (b: BoardData) => void })
```

---

## LOW

### L-1 — `createId()` Uses `Math.random()` (Not Cryptographically Random)

**Category:** Security / Correctness
**File:** `frontend/src/lib/kanban.ts:172-176`

Client-generated IDs use `Math.random()`, which is not cryptographically secure. Collisions would silently overwrite cards.

**Fix:**
```ts
export const createId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
```

---

### L-2 — `@app.on_event("startup")` Is Deprecated

**Category:** Maintainability
**File:** `backend/main.py:43`

Deprecated since FastAPI 0.93 in favour of `lifespan` context managers. Currently emits deprecation warnings.

**Fix:**
```python
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_db()
    yield

app = FastAPI(lifespan=lifespan)
```

---

### L-3 — `datetime.utcnow()` Deprecated in Python 3.12+

**Category:** Maintainability
**File:** `backend/db.py:49`

`datetime.utcnow()` is deprecated since Python 3.12 and returns a naive (timezone-unaware) datetime.

**Fix:**
```python
from datetime import datetime, timezone
now = datetime.now(timezone.utc).isoformat()
```

---

### L-4 — Test Clients Share Module-Level State (No Test Isolation)

**Category:** Test Coverage
**File:** `backend/test_main.py:11`, `backend/test_board.py:5`

Both test files create `client = TestClient(app)` at module level, sharing the same `app` singleton and in-memory `sessions` dict. A login in one test bleeds session state into subsequent tests. Tests also share the real `pm.db` on disk, making test outcomes depend on prior runs.

**Fix:**
Create the `TestClient` inside a pytest `function`-scoped fixture and pass an in-memory SQLite path (`:memory:`) via the `db_path` parameter so each test starts clean.

---

### L-5 — Duplicate Condition in `KanbanBoard.test.tsx` Mock

**Category:** Test Coverage
**File:** `frontend/src/components/KanbanBoard.test.tsx:18`

```ts
if (url.endsWith("/api/board") || url.endsWith("/api/board")) {
```

Both branches of the OR are identical — the second is dead code, likely a copy-paste error.

**Fix:**
Audit which URLs the component fetches in this test context and replace the duplicate with the correct URL.

---

### L-6 — `position < 0` Not Validated in `PATCH /api/cards/{card_id}`

**Category:** Robustness
**File:** `backend/main.py:328-331`

`list.insert(-1, x)` in Python inserts before the last element, not at the end. A client sending `position: -1` produces unexpected ordering with no error.

**Fix:**
```python
class CardUpdate(BaseModel):
    position: int | None = Field(default=None, ge=0)
```

---

### L-7 — No Input Length Validation on Card `title` and `details`

**Category:** Robustness
**File:** `backend/main.py:252-256`

`CardCreate.title` and `details` have no `max_length` constraint. A multi-megabyte title would be stored and returned to every client loading the board.

**Fix:**
```python
class CardCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    details: str = Field("", max_length=5000)
```

---

### L-8 — E2E Tests Run Against Dev Server, Not Production Build

**Category:** Test Coverage
**File:** `frontend/playwright.config.ts:13-17`

The `webServer` command is `npm run dev`, so E2E tests never exercise the `npm run build` output that is actually shipped in Docker. The `output: "export"` + `rewrites()` incompatibility (H-2) would never be caught by these tests because the dev server supports rewrites.

**Fix:**
Add a CI step that runs `npm run build` then serves `out/` statically against a running backend, and runs the Playwright suite against that.

---

## Summary Table

| ID  | Severity | Category | File |
|-----|----------|----------|------|
| C-1 | Critical | Security | `.env` |
| C-2 | Critical | Security | `backend/main.py:20-21`, `login/page.tsx:7` |
| C-3 | Critical | Security/Correctness | `backend/main.py:23` |
| H-1 | High | Security | `backend/main.py:104-107` |
| H-2 | High | Correctness | `frontend/next.config.ts:3-13` |
| H-3 | High | Correctness | `backend/requirements.txt:6` |
| H-4 | High | Correctness | `backend/main.py:282` |
| M-1 | Medium | Security | `backend/main.py:74` |
| M-2 | Medium | Security | `backend/main.py:81-87` |
| M-3 | Medium | Robustness | `frontend/src/components/KanbanBoard.tsx:47-147` |
| M-4 | Medium | Security/Robustness | `backend/main.py:60-66` |
| M-5 | Medium | Security | `backend/main.py:23,79` |
| M-6 | Medium | Performance | `backend/db.py:9-13` |
| M-7 | Medium | Correctness | `backend/main.py:241-244` |
| M-8 | Medium | Maintainability | `frontend/src/components/ChatSidebar.tsx:7` |
| L-1 | Low | Security | `frontend/src/lib/kanban.ts:172` |
| L-2 | Low | Maintainability | `backend/main.py:43` |
| L-3 | Low | Maintainability | `backend/db.py:49` |
| L-4 | Low | Test Coverage | `backend/test_main.py:11`, `test_board.py:5` |
| L-5 | Low | Test Coverage | `frontend/src/components/KanbanBoard.test.tsx:18` |
| L-6 | Low | Robustness | `backend/main.py:328-331` |
| L-7 | Low | Robustness | `backend/main.py:252-256` |
| L-8 | Low | Test Coverage | `frontend/playwright.config.ts:13` |
