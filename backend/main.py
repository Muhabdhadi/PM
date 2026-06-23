import os
import sys

# Ensure the backend directory is on sys.path so sibling modules are importable
# whether the app is run from the project root (uvicorn backend.main:app)
# or from inside backend/ (pytest, direct execution).
sys.path.insert(0, os.path.dirname(__file__))

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

import config
import db
from auth import router as auth_router
from board import router as board_router
from ai import router as ai_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_db()
    yield


app = FastAPI(lifespan=lifespan)
app.state.limiter = config.limiter
app.add_middleware(SlowAPIMiddleware)


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse({"detail": "Too many requests"}, status_code=429)


app.include_router(auth_router)
app.include_router(board_router)
app.include_router(ai_router)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/{full_path:path}")
def serve_static(full_path: str):
    requested = os.path.join(config.STATIC_DIR, full_path)
    if os.path.isfile(requested):
        return FileResponse(requested)
    # Next.js static export emits "<route>.html" for each page, so map
    # extensionless deep links (e.g. /register, /login) to their HTML file.
    html_candidate = os.path.join(config.STATIC_DIR, f"{full_path}.html")
    if full_path and os.path.isfile(html_candidate):
        return FileResponse(html_candidate, media_type="text/html")
    index = os.path.join(config.STATIC_DIR, "index.html")
    if os.path.exists(index):
        return FileResponse(index, media_type="text/html")
    return HTMLResponse("<h1>PM Backend</h1><p>No static site found.</p>")
