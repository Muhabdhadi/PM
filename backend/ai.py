import json
import os

import requests
from fastapi import APIRouter, Depends, HTTPException
from pydantic import ValidationError

import db
from auth import get_username_from_session
from models import AIRequest, StructuredAIResponse

router = APIRouter()


def _get_openrouter_api_key() -> str:
    key = os.getenv("OPENROUTER_API_KEY")
    if not key:
        raise HTTPException(status_code=500, detail="OPENROUTER_API_KEY is not configured")
    return key


def _extract_json_object(text: str) -> dict:
    try:
        return json.loads(text)
    except ValueError:
        start = text.find("{")
        end = text.rfind("}")
        if start == -1 or end == -1 or end <= start:
            raise ValueError("No valid JSON object found in AI response")
        return json.loads(text[start : end + 1])


def _build_messages(board: dict | None, history: list[dict] | None, prompt: str) -> list[dict]:
    instructions = (
        "You are an assistant for a Kanban board. "
        'Respond only with valid JSON matching the schema: {"response": string, '
        '"kanbanUpdate": {"columns": [...], "cards": {...}} }. '
        "Always return the complete board state in kanbanUpdate. "
        "If no board update is required, omit kanbanUpdate or set it to null."
    )
    messages: list[dict] = [{"role": "system", "content": instructions}]
    if board is not None:
        board_str = json.dumps(board)[:8000]
        messages.append({"role": "system", "content": f"Current board state: {board_str}"})
    if history:
        messages.extend(history[:50])
    messages.append({"role": "user", "content": prompt})
    return messages


@router.get("/api/echo")
def echo(q: str = "hello"):
    return {"echo": q}


@router.post("/api/ai")
def ai_proxy(payload: AIRequest, username: str | None = Depends(get_username_from_session)):
    if username is None:
        raise HTTPException(status_code=401, detail="Unauthorized")

    api_key = _get_openrouter_api_key()
    messages = _build_messages(payload.board, payload.history, payload.prompt)

    try:
        resp = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": "openai/gpt-oss-120b:free",
                "messages": messages,
                "temperature": 0.2,
                "max_tokens": 250,
            },
            timeout=30,
        )
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail=f"OpenRouter request failed: {exc}")

    if resp.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"OpenRouter returned {resp.status_code}: {resp.text}",
        )

    try:
        result = resp.json()
    except ValueError:
        raise HTTPException(status_code=502, detail="Invalid JSON received from OpenRouter")

    choices = result.get("choices")
    if not choices or not isinstance(choices, list):
        raise HTTPException(status_code=502, detail="OpenRouter response missing choices")

    content = choices[0].get("message", {}).get("content")
    if content is None:
        raise HTTPException(status_code=502, detail="OpenRouter response missing message content")

    try:
        structured = StructuredAIResponse.model_validate(_extract_json_object(content))
    except (ValueError, ValidationError) as exc:
        raise HTTPException(status_code=502, detail=f"Invalid AI structured output: {exc}")

    response_payload: dict = {
        "status": "ok",
        "response": structured.response,
        "boardUpdate": structured.kanbanUpdate.model_dump() if structured.kanbanUpdate else None,
        "model": result.get("model"),
        "raw": result,
    }

    if structured.kanbanUpdate is not None:
        current = db.get_board(username) or {"columns": [], "cards": {}}
        ai = structured.kanbanUpdate.model_dump()
        ai_col_ids = {c["id"] for c in ai["columns"]}
        board_object = {
            "columns": ai["columns"] + [
                c for c in current.get("columns", []) if c["id"] not in ai_col_ids
            ],
            "cards": {**current.get("cards", {}), **ai["cards"]},
        }
        db.upsert_board(username, board_object)
        response_payload["board"] = board_object

    return response_payload
