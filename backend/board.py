import secrets

from fastapi import APIRouter, Depends, HTTPException

import db
from db import DEFAULT_BOARD  # re-exported for tests/back-compat
from auth import require_user
from models import BoardCreate, BoardRename, CardCreate, CardUpdate, KanbanUpdate

router = APIRouter()

__all__ = ["router", "DEFAULT_BOARD"]


def _resolve_board_id(user: dict, board_id: int | None) -> int:
    """Return an owned board id, defaulting to the user's first board."""
    if board_id is None:
        return db.get_or_create_default_board(user["id"])
    row = db.get_board_row(board_id)
    if row is None or row["owner_id"] != user["id"]:
        raise HTTPException(status_code=404, detail="Board not found")
    return board_id


# --- Board collection ----------------------------------------------------

@router.get("/api/boards")
def list_boards(user=Depends(require_user)):
    boards = db.list_boards(user["id"])
    if not boards:
        db.get_or_create_default_board(user["id"])
        boards = db.list_boards(user["id"])
    return {"boards": boards}


@router.post("/api/boards", status_code=201)
def create_board(payload: BoardCreate, user=Depends(require_user)):
    board_id = db.create_board(user["id"], payload.name, DEFAULT_BOARD)
    return {"status": "ok", "board": {"id": board_id, "name": payload.name}}


@router.patch("/api/boards/{board_id}")
def rename_board(board_id: int, payload: BoardRename, user=Depends(require_user)):
    _resolve_board_id(user, board_id)
    db.rename_board(board_id, payload.name)
    return {"status": "ok", "board": {"id": board_id, "name": payload.name}}


@router.delete("/api/boards/{board_id}")
def delete_board(board_id: int, user=Depends(require_user)):
    _resolve_board_id(user, board_id)
    db.delete_board(board_id)
    return {"status": "ok"}


# --- Single board kanban -------------------------------------------------

@router.get("/api/board")
def get_board(board_id: int | None = None, user=Depends(require_user)):
    resolved = _resolve_board_id(user, board_id)
    row = db.get_board_row(resolved)
    kanban = db.get_board_kanban(resolved) or {"columns": [], "cards": {}}
    return {"board": kanban, "boardId": resolved, "name": row["name"] if row else None}


@router.put("/api/board")
def put_board(payload: KanbanUpdate, board_id: int | None = None, user=Depends(require_user)):
    resolved = _resolve_board_id(user, board_id)
    db.update_board_kanban(resolved, payload.model_dump())
    return {"status": "ok", "boardId": resolved}


# --- Cards ---------------------------------------------------------------

@router.post("/api/cards")
def create_card(card: CardCreate, board_id: int | None = None, user=Depends(require_user)):
    resolved = _resolve_board_id(user, board_id)
    board = db.get_board_kanban(resolved) or {"columns": [], "cards": {}}
    card_id = card.id or f"card-{secrets.token_hex(4)}"
    card_obj = {"id": card_id, "title": card.title, "details": card.details}
    for field in ("priority", "dueDate", "labels", "assignee"):
        value = getattr(card, field)
        if value is not None:
            card_obj[field] = value
    col = next((c for c in board["columns"] if c["id"] == card.columnId), None)
    if col is None:
        raise HTTPException(status_code=400, detail="Invalid columnId")
    board["cards"][card_id] = card_obj
    col["cardIds"].append(card_id)
    db.update_board_kanban(resolved, board)
    return {"status": "ok", "card": card_obj}


@router.patch("/api/cards/{card_id}")
def update_card(
    card_id: str,
    payload: CardUpdate,
    board_id: int | None = None,
    user=Depends(require_user),
):
    resolved = _resolve_board_id(user, board_id)
    board = db.get_board_kanban(resolved) or {"columns": [], "cards": {}}
    cards = board.get("cards", {})
    if card_id not in cards:
        raise HTTPException(status_code=404, detail="Card not found")
    card = cards[card_id]
    provided = payload.model_dump(exclude_unset=True)
    if payload.title is not None:
        card["title"] = payload.title
    if payload.details is not None:
        card["details"] = payload.details
    # Metadata fields: a provided value (incl. null/empty) is applied so the
    # editor can both set and clear them.
    for field in ("priority", "dueDate", "labels", "assignee"):
        if field in provided:
            value = provided[field]
            if value in (None, "", []):
                card.pop(field, None)
            else:
                card[field] = value
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
    db.update_board_kanban(resolved, board)
    return {"status": "ok", "card": card}


@router.delete("/api/cards/{card_id}")
def delete_card(card_id: str, board_id: int | None = None, user=Depends(require_user)):
    resolved = _resolve_board_id(user, board_id)
    board = db.get_board_kanban(resolved) or {"columns": [], "cards": {}}
    cards = board.get("cards", {})
    if card_id not in cards:
        raise HTTPException(status_code=404, detail="Card not found")
    for c in board["columns"]:
        if card_id in c["cardIds"]:
            c["cardIds"].remove(card_id)
    cards.pop(card_id, None)
    db.update_board_kanban(resolved, board)
    return {"status": "ok"}
