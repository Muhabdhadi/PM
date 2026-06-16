import os
import pytest
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_login_sets_session_cookie_and_auth_status():
    response = client.post(
        "/api/login",
        json={"username": "user", "password": "password"},
    )

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert "session_token" in response.cookies

    auth_response = client.get("/api/auth-status")
    assert auth_response.status_code == 200
    assert auth_response.json() == {"authenticated": True, "username": "user"}


def test_logout_clears_session():
    login_response = client.post(
        "/api/login",
        json={"username": "user", "password": "password"},
    )
    assert login_response.status_code == 200

    logout_response = client.post("/api/logout")
    assert logout_response.status_code == 200
    assert logout_response.json() == {"status": "ok"}

    auth_response = client.get("/api/auth-status")
    assert auth_response.status_code == 200
    assert auth_response.json() == {"authenticated": False, "username": None}


def test_invalid_login_rejected():
    response = client.post(
        "/api/login",
        json={"username": "user", "password": "wrong"},
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid credentials"


def test_ai_proxy_calls_openrouter_live():
    if not os.getenv("OPENROUTER_API_KEY"):
        pytest.skip("OPENROUTER_API_KEY is not set")

    login_response = client.post(
        "/api/login",
        json={"username": "user", "password": "password"},
    )
    assert login_response.status_code == 200

    response = client.post(
        "/api/ai",
        json={"prompt": "What is 2+2?"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert isinstance(data.get("output"), str)
    assert data["output"].strip() != ""
