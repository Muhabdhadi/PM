# Code Review: Project Management MVP

**Reviewer:** opencode (AI code review)
**Date:** 2026-06-20
**Scope:** Full codebase -- backend, frontend, infrastructure, tests, documentation

---

## Executive Summary

The project delivers a functional Kanban board MVP with FastAPI backend, Next.js frontend, SQLite persistence, and AI chat integration via OpenRouter. The architecture is clean and well-modularized. The previous code review (referenced in PLAN.md) addressed 23 findings. This review identifies remaining issues that were either introduced after that review or not covered. There are 2 critical, 3 high, 7 medium, and 6 low severity findings.

---

## Critical (2)

### C-1: API key exposed in `.env` file committed to version control

**File:** `.env:1`
**Issue:** The `.env` file contains a live `OPENROUTER_API_KEY` (`sk-or-v1-139b...`). While `.env` is listed in `.gitignore`, the key may already be in git history if it was committed before the gitignore rule was added.

**Impact:** Anyone with repo access can use the API key and rack up charges.

**Fix:**
1. Revoke the current key on OpenRouter immediately.
2. Generate a new key and place it in `.env`.
3. Confirm `.env` is in `.gitignore` (it is).
4. If the key was ever committed, use BFG Repo Cleaner to remove it from history.
5. Provide a `.env.example` with a placeholder value instead.

---

### C-2: Catch-all route can silently mask errors

**File:** `backend/main.py:49-57`
**Issue:** The `/{full_path:path}` catch-all serves `index.html` for any unknown path when `backend/static/` exists. If a router fails to register (e.g., import error), the catch-all silently returns the frontend HTML instead of a proper 404, making debugging very difficult.

**Impact:** Hidden errors in development and production.

**Fix:** Log or return a 404 JSON response when no static file matches and the path looks like an API route. Consider checking `STATIC_DIR` existence at startup.

---

## High (3)

### H-1: Thread-local SQLite connections can leak

**File:** `backend/db.py:14-34`
**Issue:** The `_conn()` context manager reuses thread-local connections but never closes them on server shutdown. Connections accumulate over the server's lifetime.

**Impact:** Connection leak in long-running processes.

**Fix:** Close connections in the `lifespan` shutdown handler, or use a connection pool.

---

### H-2: AI board merge can lose columns and cards

**File:** `backend/ai.py:114-124`
**Issue:** The merge replaces the column list with `ai["columns"] + [current columns not in AI]`. If the AI returns a partial update (e.g., only the Backlog column), all other columns are dropped.

```python
board_object = {
    "columns": ai["columns"] + [
        c for c in current.get("columns", []) if c["id"] not in ai_col_ids
    ],
    "cards": {**current.get("cards", {}), **ai["cards"]},
}
```

**Impact:** A user asks "add a card to Backlog" and the AI returns only the Backlog column. The board now has 1 column instead of 5. Data loss.

**Fix:** Preserve existing columns. For each column in the AI response: update it if it exists, add it if it doesn't. Keep all other columns unchanged.

---

### H-3: Synchronous `requests.post()` blocks FastAPI threadpool

**File:** `backend/ai.py:65-78`
**Issue:** The `/api/ai` handler uses `requests.post()` with a 30-second timeout. FastAPI runs sync handlers in a threadpool, so each AI request occupies a thread for up to 30s.

**Impact:** Under concurrent AI requests, the threadpool exhausts, starving health/board/auth endpoints.

**Fix:** Use `httpx.AsyncClient` with an `async def` handler, or increase threadpool size.

---

## Medium (7)

### M-1: No validation that AI board update maintains card integrity

**File:** `backend/ai.py:114-124`
**Issue:** Cards can become orphaned if AI returns cards without corresponding column references.

**Impact:** Invisible cards that consume database space.

**Fix:** After merging, validate that every card ID in a column's `cardIds` exists in `cards`, and vice versa.

---

### M-2: Login page pre-fills username but not password

**File:** `frontend/src/app/login/page.tsx:7-8`
**Issue:** Username is pre-filled as `"user"` but password field starts empty, despite demo credentials box showing both.

**Impact:** Minor UX inconsistency.

**Fix:** Pre-fill both fields for demo convenience, or neither.

---

### M-3: `ChatSidebar` message key uses array index

**File:** `frontend/src/components/ChatSidebar.tsx:54`
**Issue:** Messages rendered with `key={i}` is fragile if messages are ever reordered.

**Impact:** Minor rendering glitches if message list mutates.

**Fix:** Use a unique ID per message (e.g., `crypto.randomUUID()` at creation time).

---

### M-4: `PUT /api/board` has no referential integrity check

**File:** `backend/board.py:42-47`
**Issue:** Cards referenced in columns may not exist in cards dict. No validation before persisting.

**Impact:** Malformed board state causes frontend rendering errors.

**Fix:** Validate referential integrity between columns and cards before upserting.

---

### M-5: `delete_expired_sessions` is never called

**File:** `backend/db.py:123-127`
**Issue:** The function exists but is never invoked. Expired sessions accumulate indefinitely.

**Impact:** Slow degradation of session lookup performance.

**Fix:** Call on server startup (in lifespan context manager) or on a periodic background task.

---

### M-6: No CSRF protection on state-changing endpoints

**File:** `backend/auth.py:18-50`
**Issue:** Login, logout, and all API endpoints accept requests without CSRF tokens.

**Impact:** A malicious site could trigger state-changing requests.

**Fix:** `SameSite=Strict` (already done) mitigates most CSRF. For production, add CSRF token validation.

---

### M-7: `saveBoard` during column rename is fire-and-forget

**File:** `frontend/src/components/KanbanBoard.tsx:45-56`
**Issue:** `saveBoard` is not awaited and has no revert on failure.

**Impact:** If save fails, UI shows new name but server has old name. Lost on page reload.

**Fix:** Await the save and revert on failure (like `handleDragEnd` does), or accept eventual consistency.

---

## Low (6)

### L-1: Two HTTP client libraries (`requests` and `httpx`) in requirements

**File:** `backend/requirements.txt`
**Issue:** `httpx` is listed but `ai.py` uses `requests`. Two HTTP client libraries for the same purpose.

**Fix:** Remove one and standardize.

---

### L-2: `conftest.py` imports `main` inside fixture body

**File:** `backend/conftest.py:19-20`
**Issue:** Works fine, but a comment explaining why would help.

**Fix:** Add a brief comment.

---

### L-3: `playwright.config.ts` uses `py -m uvicorn` (Windows-only)

**File:** `frontend/playwright.config.ts:16`
**Issue:** `py` launcher is Windows-specific. Won't work on Linux/macOS.

**Fix:** Use `python -m uvicorn` or detect platform.

---

### L-4: `pydantic` not explicitly in `requirements.txt`

**File:** `backend/requirements.txt`
**Issue:** Relies on FastAPI pulling it transitively.

**Fix:** Add `pydantic` as an explicit dependency.

---

### L-5: Minor flash during auth check loading state

**File:** `frontend/src/components/AuthGate.tsx:34-42`
**Issue:** Brief loading spinner before auth check completes.

**Fix:** Acceptable for MVP. Could add skeleton loader.

---

### L-6: `stop.ps1` doesn't suppress errors for non-existent containers

**File:** `scripts/stop.ps1:1`
**Issue:** Shows errors when stopping a non-running container.

**Fix:** Add `2>$null` to suppress errors.

---

## Positive Observations

1. Clean modular backend architecture with single-responsibility modules
2. Proper Pydantic field validation (min_length, max_length, ge=0)
3. Optimistic UI with revert on failure for drag-drop, card create/delete
4. Thread-local SQLite connections avoiding per-request overhead
5. Test isolation via conftest.py with per-test SQLite databases
6. Consistent color scheme following documented design tokens
7. Server-side validation of AI structured output before applying changes

---

## Summary

| Severity | Count | Key Areas |
|----------|-------|-----------|
| Critical | 2 | API key exposure, catch-all route fragility |
| High | 3 | Connection leak, AI board merge data loss, sync blocking |
| Medium | 7 | Orphaned cards, UX consistency, CSRF, session cleanup |
| Low | 6 | Dependency cleanup, cross-platform scripts, error handling |

---

## Recommendations by Priority

1. **Immediate:** Rotate the exposed API key (C-1).
2. **Before any deployment:** Fix AI board merge logic (H-2) to prevent data loss.
3. **Before scale:** Switch AI endpoint to async httpx (H-3) and fix connection lifecycle (H-1).
4. **Polish:** Address medium findings for robustness and UX consistency.
5. **Cleanup:** Address low findings for code hygiene and cross-platform support.
