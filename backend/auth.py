import secrets

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response

import config
import db
from models import LoginData, PasswordChange, RegisterData
from security import hash_password, verify_password

router = APIRouter()


def get_current_user(session_token: str | None = Cookie(None)):
    """Return the authenticated user row ({'id', 'username'}) or None."""
    if session_token is None:
        return None
    return db.get_session_user(session_token)


def require_user(user=Depends(get_current_user)):
    if user is None:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return user


# Backwards-compatible helper: some modules only need the username.
def get_username_from_session(user=Depends(get_current_user)) -> str | None:
    return user["username"] if user else None


def _issue_session(response: Response, user_id: int) -> None:
    token = secrets.token_urlsafe(32)
    db.create_session(token, user_id)
    response.set_cookie(
        key=config.SESSION_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=config.COOKIE_SECURE,
        samesite="strict",
        path="/",
    )


@router.post("/api/register", status_code=201)
@config.limiter.limit("5/minute")
def register(request: Request, data: RegisterData, response: Response):
    if db.get_user_by_username(data.username) is not None:
        raise HTTPException(status_code=409, detail="Username already taken")
    user_id = db.create_user(data.username, hash_password(data.password))
    db.get_or_create_default_board(user_id)
    _issue_session(response, user_id)
    return {"status": "ok", "username": data.username}


@router.post("/api/login")
@config.limiter.limit("10/minute")
def login(request: Request, data: LoginData, response: Response):
    user = db.get_user_by_username(data.username)
    if user is None or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    db.get_or_create_default_board(user["id"])
    _issue_session(response, user["id"])
    return {"status": "ok"}


@router.post("/api/logout")
def logout(response: Response, session_token: str | None = Cookie(None)):
    if session_token:
        db.delete_session(session_token)
    response.delete_cookie(
        key=config.SESSION_COOKIE_NAME,
        path="/",
        secure=config.COOKIE_SECURE,
        samesite="strict",
    )
    return {"status": "ok"}


@router.post("/api/account/password")
def change_password(data: PasswordChange, user=Depends(require_user)):
    row = db.get_user_by_username(user["username"])
    if row is None or not verify_password(data.current_password, row["password_hash"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    db.update_user_password(user["id"], hash_password(data.new_password))
    return {"status": "ok"}


@router.get("/api/auth-status")
def auth_status(user=Depends(get_current_user)):
    return {
        "authenticated": user is not None,
        "username": user["username"] if user else None,
    }
