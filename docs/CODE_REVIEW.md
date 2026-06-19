# Code Review: Kanban Project Management MVP

**Date:** 2026-06-19
**Scope:** Full codebase — backend (FastAPI/Python), frontend (Next.js/TypeScript), infrastructure (Docker)
**Status:** All 23 findings remediated — 18/18 tests passing (8 backend + 7 frontend unit + 3 e2e).

---

## Remediation Summary

All critical, high, medium, and low findings were addressed immediately after the review. Key changes:

- **Sessions** moved from in-memory dict to a SQLite `sessions` table with 24-hour TTL.
- **Credentials** loaded from `APP_USERNAME` / `APP_PASSWORD` env vars; compared via `secrets.compare_digest`.
- **Rate limiting** added to `/api/login` via `slowapi` (10 req/min per IP).
- **Session cookie** hardened: `httponly=True`, `samesite="strict"`, `secure` read from env.
- **`AIRequest`** fields bounded (`prompt` ≤ 2 000 chars, `history` ≤ 50 items); board JSON capped at 8 000 chars.
- **`PUT /api/board`** now validates body against the `KanbanUpdate` Pydantic model.
- **AI board updates** merged onto existing board rather than replacing it.
- **Frontend mutations** revert optimistic state and log errors on failure.
- **Thread-local SQLite connections** replace per-request `connect()`.
- **`copy.deepcopy(DEFAULT_BOARD)`** replaces shallow copy.
- **`next.config.ts`** `rewrites()` removed (incompatible with `output: "export"`).
- **E2E tests** rebuild the frontend and run against the real backend on port 8000.
- **Per-test DB isolation** via `conftest.py` with `tmp_path`-scoped SQLite.
- All Python deprecation warnings resolved (`lifespan`, `datetime.now(timezone.utc)`, `crypto.randomUUID()`).

After remediation, `backend/main.py` was refactored from a 230-line monolith into focused modules: `config.py`, `models.py`, `auth.py`, `board.py`, `ai.py`, and a 45-line `main.py` app factory.

---

## Executive Summary

The codebase is well-structured and readable for an MVP learning project. The test scaffold covers the happy path adequately. However there are **three critical and four high severity issues** that must be addressed before any public or shared deployment: a committed API key, hard-coded plaintext credentials, in-memory session storage that is not multi-worker safe, an unbounded AI prompt injection surface, a broken Next.js configuration, a missing Python package, and a shallow-copy bug that corrupts shared state across requests. Below those sit a cluster of medium issues (no rate limiting, silent fire-and-forget mutations, unvalidated PUT body, missing cookie flags) and several low/maintainability items.

---

## Summary Table

| ID  | Severity | Category | Original file | Status |
|-----|----------|----------|---------------|--------|
| C-1 | Critical | Security | `.env` | ✅ Fixed |
| C-2 | Critical | Security | `backend/main.py:20-21` | ✅ Fixed — env vars + `secrets.compare_digest` |
| C-3 | Critical | Security/Correctness | `backend/main.py:23` | ✅ Fixed — SQLite sessions table |
| H-1 | High | Security | `backend/main.py:104-107` | ✅ Fixed — field length limits + board truncation |
| H-2 | High | Correctness | `frontend/next.config.ts:3-13` | ✅ Fixed — `rewrites()` removed |
| H-3 | High | Correctness | `backend/requirements.txt:6` | ✅ Fixed — `httpx2` → `httpx` |
| H-4 | High | Correctness | `backend/main.py:282` | ✅ Fixed — `copy.deepcopy()` |
| M-1 | Medium | Security | `backend/main.py:74` | ✅ Fixed — `slowapi` 10/min |
| M-2 | Medium | Security | `backend/main.py:81-87` | ✅ Fixed — `samesite="strict"`, `secure` from env |
| M-3 | Medium | Robustness | `frontend/src/components/KanbanBoard.tsx` | ✅ Fixed — revert on error |
| M-4 | Medium | Security/Robustness | `backend/main.py:60-66` | ✅ Fixed — `KanbanUpdate` validation |
| M-5 | Medium | Security | `backend/main.py:23,79` | ✅ Fixed — `expires_at` TTL in DB |
| M-6 | Medium | Performance | `backend/db.py:9-13` | ✅ Fixed — thread-local connections |
| M-7 | Medium | Correctness | `backend/main.py:241-244` | ✅ Fixed — merge not replace |
| M-8 | Medium | Maintainability | `frontend/src/components/ChatSidebar.tsx:7` | ✅ Fixed — `BoardData` types |
| L-1 | Low | Security | `frontend/src/lib/kanban.ts:172` | ✅ Fixed — `crypto.randomUUID()` |
| L-2 | Low | Maintainability | `backend/main.py:43` | ✅ Fixed — `lifespan` context manager |
| L-3 | Low | Maintainability | `backend/db.py:49` | ✅ Fixed — `datetime.now(timezone.utc)` |
| L-4 | Low | Test Coverage | `backend/test_main.py:11` | ✅ Fixed — `conftest.py` per-test isolation |
| L-5 | Low | Test Coverage | `frontend/src/components/KanbanBoard.test.tsx:18` | ✅ Fixed — duplicate condition removed |
| L-6 | Low | Robustness | `backend/main.py:328-331` | ✅ Fixed — `ge=0` on `position` |
| L-7 | Low | Robustness | `backend/main.py:252-256` | ✅ Fixed — `min_length` / `max_length` on card fields |
| L-8 | Low | Test Coverage | `frontend/playwright.config.ts:13` | ✅ Fixed — `globalSetup` builds + copies to `backend/static/` |
