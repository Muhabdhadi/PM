from fastapi import Cookie, Depends, FastAPI, HTTPException, Response
from fastapi.responses import FileResponse, HTMLResponse
from pydantic import BaseModel
import os
import json
import secrets
import requests
from dotenv import load_dotenv
try:
    import db
except ModuleNotFoundError:
    # when running inside Docker the package path may be different
    from backend import db

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
load_dotenv(os.path.join(PROJECT_ROOT, ".env"))

app = FastAPI()
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
VALID_USERNAME = "user"
VALID_PASSWORD = "password"
SESSION_COOKIE_NAME = "session_token"
sessions: dict[str, str] = {}

# Ensure DB exists when module is imported (helps tests and single-process runs)
try:
    db.init_db()
except Exception:
    pass


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


class AIRequest(BaseModel):
    prompt: str
    board: dict | None = None
    history: list[dict] | None = None


def get_openrouter_api_key() -> str:
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="OPENROUTER_API_KEY is not configured")
    return api_key


@app.get("/api/echo")
def echo(q: str = "hello"):
    return {"echo": q}


@app.post("/api/ai")
def ai_proxy(payload: AIRequest, username: str | None = Depends(get_username_from_session)):
    if username is None:
        raise HTTPException(status_code=401, detail="Unauthorized")

    api_key = get_openrouter_api_key()
    messages = []
    if payload.board is not None:
        messages.append({
            "role": "system",
            "content": f"Current board state: {json.dumps(payload.board)}",
        })
    if payload.history:
        messages.extend(payload.history)
    messages.append({"role": "user", "content": payload.prompt})

    body = {
        "model": "openai/gpt-oss-120b:free",
        "messages": messages,
        "temperature": 0.2,
        "max_tokens": 150,
    }

    try:
        response = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=body,
            timeout=30,
        )
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail=f"OpenRouter request failed: {exc}")

    if response.status_code != 200:
        raise HTTPException(status_code=502, detail=f"OpenRouter returned {response.status_code}: {response.text}")

    try:
        result = response.json()
    except ValueError:
        raise HTTPException(status_code=502, detail="Invalid JSON received from OpenRouter")

    choices = result.get("choices")
    if not choices or not isinstance(choices, list):
        raise HTTPException(status_code=502, detail="OpenRouter response missing choices")

    message = choices[0].get("message", {})
    content = message.get("content")
    if content is None:
        raise HTTPException(status_code=502, detail="OpenRouter response missing message content")

    return {
        "status": "ok",
        "model": result.get("model"),
        "output": content,
        "raw": result,
    }


# ----- Card-level CRUD (Part 6) -----


class CardCreate(BaseModel):
    id: str | None = None
    title: str
    details: str = ""
    columnId: str


class CardUpdate(BaseModel):
    title: str | None = None
    details: str | None = None
    columnId: str | None = None
    position: int | None = None


DEFAULT_BOARD = {
    "columns": [
        {"id": "col-backlog", "title": "Backlog", "cardIds": []},
        {"id": "col-discovery", "title": "Discovery", "cardIds": []},
        {"id": "col-progress", "title": "In Progress", "cardIds": []},
        {"id": "col-review", "title": "Review", "cardIds": []},
        {"id": "col-done", "title": "Done", "cardIds": []},
    ],
    "cards": {},
}


def _ensure_board(username: str):
    board = db.get_board(username)
    if board is None:
        db.upsert_board(username, DEFAULT_BOARD)
        return DEFAULT_BOARD.copy()
    return board


@app.post("/api/cards")
def create_card(card: CardCreate, username: str | None = Depends(get_username_from_session)):
    if username is None:
        raise HTTPException(status_code=401, detail="Unauthorized")
    board = _ensure_board(username)
    card_id = card.id or f"card-{secrets.token_hex(4)}"
    card_obj = {"id": card_id, "title": card.title, "details": card.details}
    # add to cards
    board["cards"][card_id] = card_obj
    # find column
    col = next((c for c in board["columns"] if c["id"] == card.columnId), None)
    if col is None:
        raise HTTPException(status_code=400, detail="Invalid columnId")
    col["cardIds"].append(card_id)
    db.upsert_board(username, board)
    return {"status": "ok", "card": card_obj}


@app.patch("/api/cards/{card_id}")
def update_card(card_id: str, payload: CardUpdate, username: str | None = Depends(get_username_from_session)):
    if username is None:
        raise HTTPException(status_code=401, detail="Unauthorized")
    board = _ensure_board(username)
    cards = board.get("cards", {})
    if card_id not in cards:
        raise HTTPException(status_code=404, detail="Card not found")
    card = cards[card_id]
    # update fields
    if payload.title is not None:
        card["title"] = payload.title
    if payload.details is not None:
        card["details"] = payload.details
    # handle column move
    if payload.columnId is not None:
        # remove from old column
        for c in board["columns"]:
            if card_id in c["cardIds"]:
                c["cardIds"].remove(card_id)
        # add to new column at position if provided
        new_col = next((c for c in board["columns"] if c["id"] == payload.columnId), None)
        if new_col is None:
            raise HTTPException(status_code=400, detail="Invalid columnId")
        if payload.position is None or payload.position >= len(new_col["cardIds"]):
            new_col["cardIds"].append(card_id)
        else:
            new_col["cardIds"].insert(payload.position, card_id)

    db.upsert_board(username, board)
    return {"status": "ok", "card": card}


@app.delete("/api/cards/{card_id}")
def delete_card(card_id: str, username: str | None = Depends(get_username_from_session)):
    if username is None:
        raise HTTPException(status_code=401, detail="Unauthorized")
    board = _ensure_board(username)
    cards = board.get("cards", {})
    if card_id not in cards:
        raise HTTPException(status_code=404, detail="Card not found")
    # remove from columns
    for c in board["columns"]:
        if card_id in c["cardIds"]:
            c["cardIds"].remove(card_id)
    # remove card
    cards.pop(card_id, None)
    db.upsert_board(username, board)
    return {"status": "ok"}


@app.get("/{full_path:path}")
def serve_static(full_path: str):
    requested_path = os.path.join(STATIC_DIR, full_path)
    if os.path.isfile(requested_path):
        return FileResponse(requested_path)

    index_path = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path, media_type="text/html")

    return HTMLResponse("<h1>PM Backend</h1><p>No static site found.</p>")
