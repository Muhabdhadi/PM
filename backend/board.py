import copy
import secrets

from fastapi import APIRouter, Depends, HTTPException

import db
from auth import get_username_from_session
from models import CardCreate, CardUpdate, KanbanUpdate

router = APIRouter()

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


def _ensure_board(username: str) -> dict:
    board = db.get_board(username)
    if board is None:
        db.upsert_board(username, DEFAULT_BOARD)
        return copy.deepcopy(DEFAULT_BOARD)
    return board


@router.get("/api/board")
def get_board(username: str | None = Depends(get_username_from_session)):
    if username is None:
        raise HTTPException(status_code=401, detail="Unauthorized")
    board = db.get_board(username)
    if board is None:
        return {"board": {"columns": [], "cards": {}}}
    return {"board": board}


@router.put("/api/board")
def put_board(payload: KanbanUpdate, username: str | None = Depends(get_username_from_session)):
    if username is None:
        raise HTTPException(status_code=401, detail="Unauthorized")
    db.upsert_board(username, payload.model_dump())
    return {"status": "ok"}


@router.post("/api/cards")
def create_card(card: CardCreate, username: str | None = Depends(get_username_from_session)):
    if username is None:
        raise HTTPException(status_code=401, detail="Unauthorized")
    board = _ensure_board(username)
    card_id = card.id or f"card-{secrets.token_hex(4)}"
    card_obj = {"id": card_id, "title": card.title, "details": card.details}
    board["cards"][card_id] = card_obj
    col = next((c for c in board["columns"] if c["id"] == card.columnId), None)
    if col is None:
        raise HTTPException(status_code=400, detail="Invalid columnId")
    col["cardIds"].append(card_id)
    db.upsert_board(username, board)
    return {"status": "ok", "card": card_obj}


@router.patch("/api/cards/{card_id}")
def update_card(
    card_id: str,
    payload: CardUpdate,
    username: str | None = Depends(get_username_from_session),
):
    if username is None:
        raise HTTPException(status_code=401, detail="Unauthorized")
    board = _ensure_board(username)
    cards = board.get("cards", {})
    if card_id not in cards:
        raise HTTPException(status_code=404, detail="Card not found")
    card = cards[card_id]
    if payload.title is not None:
        card["title"] = payload.title
    if payload.details is not None:
        card["details"] = payload.details
    if payload.columnId is not None:
        for c in board["columns"]:
            if card_id in c["cardIds"]:
                c["cardIds"].remove(card_id)
        new_col = next((c for c in board["columns"] if c["id"] == payload.columnId), None)
        if new_col is None:
            raise HTTPException(status_code=400, detail="Invalid columnId")
        if payload.position is None or payload.position >= len(new_col["cardIds"]):
            new_col["cardIds"].append(card_id)
        else:
            new_col["cardIds"].insert(payload.position, card_id)
    db.upsert_board(username, board)
    return {"status": "ok", "card": card}


@router.delete("/api/cards/{card_id}")
def delete_card(card_id: str, username: str | None = Depends(get_username_from_session)):
    if username is None:
        raise HTTPException(status_code=401, detail="Unauthorized")
    board = _ensure_board(username)
    cards = board.get("cards", {})
    if card_id not in cards:
        raise HTTPException(status_code=404, detail="Card not found")
    for c in board["columns"]:
        if card_id in c["cardIds"]:
            c["cardIds"].remove(card_id)
    cards.pop(card_id, None)
    db.upsert_board(username, board)
    return {"status": "ok"}
