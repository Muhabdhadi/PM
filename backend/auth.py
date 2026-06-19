import secrets

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response

import config
import db
from models import LoginData

router = APIRouter()


def get_username_from_session(session_token: str | None = Cookie(None)) -> str | None:
    if session_token is None:
        return None
    return db.get_session_username(session_token)


@router.post("/api/login")
@config.limiter.limit("10/minute")
def login(request: Request, data: LoginData, response: Response):
    if not (
        secrets.compare_digest(data.username, config.VALID_USERNAME)
        and secrets.compare_digest(data.password, config.VALID_PASSWORD)
    ):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = secrets.token_urlsafe(32)
    db.create_session(token, data.username)
    response.set_cookie(
        key=config.SESSION_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=config.COOKIE_SECURE,
        samesite="strict",
        path="/",
    )
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


@router.get("/api/auth-status")
def auth_status(username: str | None = Depends(get_username_from_session)):
    return {"authenticated": username is not None, "username": username}
