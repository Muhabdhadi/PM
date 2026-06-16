from fastapi import Cookie, Depends, FastAPI, HTTPException, Response
from fastapi.responses import FileResponse, HTMLResponse
from pydantic import BaseModel
import os
import secrets
import db

app = FastAPI()
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
VALID_USERNAME = "user"
VALID_PASSWORD = "password"
SESSION_COOKIE_NAME = "session_token"
sessions: dict[str, str] = {}


class LoginData(BaseModel):
    username: str
    password: str


def get_username_from_session(session_token: str | None = Cookie(None)):
    if session_token is None:
        return None
    return sessions.get(session_token)


@app.on_event("startup")
def startup_event():
    # initialize sqlite DB if missing
    db.init_db()


@app.get("/api/board")
def get_board(username: str | None = Depends(get_username_from_session)):
    if username is None:
        raise HTTPException(status_code=401, detail="Unauthorized")
    board = db.get_board(username)
    if board is None:
        # return an empty board skeleton for new users
        return {"board": {"columns": [], "cards": {}}}
    return {"board": board}


@app.put("/api/board")
def put_board(payload: dict, username: str | None = Depends(get_username_from_session)):
    if username is None:
        raise HTTPException(status_code=401, detail="Unauthorized")
    # payload is expected to be the board JSON
    db.upsert_board(username, payload)
    return {"status": "ok"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/api/login")
def login(data: LoginData, response: Response):
    if data.username != VALID_USERNAME or data.password != VALID_PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = secrets.token_urlsafe(32)
    sessions[token] = data.username
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="lax",
        path="/",
    )
    return {"status": "ok"}


@app.post("/api/logout")
def logout(response: Response, session_token: str | None = Cookie(None)):
    if session_token and session_token in sessions:
        sessions.pop(session_token, None)
    response.delete_cookie(key=SESSION_COOKIE_NAME, path="/")
    return {"status": "ok"}


@app.get("/api/auth-status")
def auth_status(username: str | None = Depends(get_username_from_session)):
    return {"authenticated": username is not None, "username": username}


@app.get("/api/echo")
def echo(q: str = "hello"):
    return {"echo": q}


@app.get("/{full_path:path}")
def serve_static(full_path: str):
    requested_path = os.path.join(STATIC_DIR, full_path)
    if os.path.isfile(requested_path):
        return FileResponse(requested_path)

    index_path = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path, media_type="text/html")

    return HTMLResponse("<h1>PM Backend</h1><p>No static site found.</p>")
