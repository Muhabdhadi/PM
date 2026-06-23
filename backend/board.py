import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

import db
from db import DEFAULT_BOARD  # re-exported for tests/back-compat
from auth import require_user
from models import (
    BoardCreate,
    BoardRename,
    CardCreate,
    CardUpdate,
    CommentCreate,
    KanbanUpdate,
    MemberAdd,
)

router = APIRouter()

__all__ = ["router", "DEFAULT_BOARD"]


def _resolve_board_id(user: dict, board_id: int | None) -> int:
    """Return an accessible board id (owned or shared), defaulting to the user's first board."""
    if board_id is None:
        return db.get_or_create_default_board(user["id"])
    if not db.user_can_access_board(board_id, user["id"]):
        raise HTTPException(status_code=404, detail="Board not found")
    return board_id


def _require_owned_board(user: dict, board_id: int) -> dict:
    row = db.get_board_row(board_id)
    if row is None or row["owner_id"] != user["id"]:
        raise HTTPException(status_code=404, detail="Board not found")
    return row


# --- Board collection ----------------------------------------------------

@router.get("/api/boards")
def list_boards(user=Depends(require_user)):
    boards = db.list_accessible_boards(user["id"])
    if not boards:
        db.get_or_create_default_board(user["id"])
        boards = db.list_accessible_boards(user["id"])
    return {"boards": boards}


@router.post("/api/boards", status_code=201)
def create_board(payload: BoardCreate, user=Depends(require_user)):
    board_id = db.create_board(user["id"], payload.name, DEFAULT_BOARD)
    return {"status": "ok", "board": {"id": board_id, "name": payload.name}}


@router.patch("/api/boards/{board_id}")
def rename_board(board_id: int, payload: BoardRename, user=Depends(require_user)):
    _require_owned_board(user, board_id)
    db.rename_board(board_id, payload.name)
    return {"status": "ok", "board": {"id": board_id, "name": payload.name}}


@router.delete("/api/boards/{board_id}")
def delete_board(board_id: int, user=Depends(require_user)):
    _require_owned_board(user, board_id)
    db.delete_board(board_id)
    return {"status": "ok"}


# --- Board collaborators -------------------------------------------------

@router.get("/api/boards/{board_id}/members")
def list_members(board_id: int, user=Depends(require_user)):
    if not db.user_can_access_board(board_id, user["id"]):
        raise HTTPException(status_code=404, detail="Board not found")
    return {"members": db.list_board_members(board_id)}


@router.post("/api/boards/{board_id}/members", status_code=201)
def add_member(board_id: int, payload: MemberAdd, user=Depends(require_user)):
    board = _require_owned_board(user, board_id)
    target = db.get_user_by_username(payload.username)
    if target is None:
        raise HTTPException(status_code=404, detail="User not found")
    if target["id"] == board["owner_id"]:
        raise HTTPException(status_code=409, detail="User already owns this board")
    db.add_board_member(board_id, target["id"])
    db.record_activity(board_id, user["username"], f"shared the board with {payload.username}")
    return {"status": "ok", "members": db.list_board_members(board_id)}


@router.delete("/api/boards/{board_id}/members/{member_id}")
def remove_member(board_id: int, member_id: int, user=Depends(require_user)):
    _require_owned_board(user, board_id)
    removed = db.get_user_by_id(member_id)
    db.remove_board_member(board_id, member_id)
    if removed:
        db.record_activity(board_id, user["username"], f"removed {removed['username']}")
    return {"status": "ok", "members": db.list_board_members(board_id)}


@router.get("/api/boards/{board_id}/activity")
def board_activity(board_id: int, user=Depends(require_user)):
    if not db.user_can_access_board(board_id, user["id"]):
        raise HTTPException(status_code=404, detail="Board not found")
    return {"activity": db.list_activity(board_id)}


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
    db.record_activity(resolved, user["username"], f"added card “{card.title}”")
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


@router.post("/api/cards/{card_id}/comments", status_code=201)
def add_comment(
    card_id: str,
    payload: CommentCreate,
    board_id: int | None = None,
    user=Depends(require_user),
):
    resolved = _resolve_board_id(user, board_id)
    board = db.get_board_kanban(resolved) or {"columns": [], "cards": {}}
    cards = board.get("cards", {})
    if card_id not in cards:
        raise HTTPException(status_code=404, detail="Card not found")
    comment = {
        "id": f"cmt-{secrets.token_hex(4)}",
        "author": user["username"],
        "text": payload.text,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    existing = cards[card_id].get("comments")
    if not isinstance(existing, list):
        existing = []
    existing.append(comment)
    cards[card_id]["comments"] = existing
    db.update_board_kanban(resolved, board)
    db.record_activity(
        resolved, user["username"], f"commented on “{cards[card_id].get('title', 'a card')}”"
    )
    return {"status": "ok", "comment": comment, "comments": existing}


@router.delete("/api/cards/{card_id}")
def delete_card(card_id: str, board_id: int | None = None, user=Depends(require_user)):
    resolved = _resolve_board_id(user, board_id)
    board = db.get_board_kanban(resolved) or {"columns": [], "cards": {}}
    cards = board.get("cards", {})
    if card_id not in cards:
        raise HTTPException(status_code=404, detail="Card not found")
    removed_title = cards[card_id].get("title", "a card")
    for c in board["columns"]:
        if card_id in c["cardIds"]:
            c["cardIds"].remove(card_id)
    cards.pop(card_id, None)
    db.update_board_kanban(resolved, board)
    db.record_activity(resolved, user["username"], f"deleted card “{removed_title}”")
    return {"status": "ok"}
