from fastapi.testclient import TestClient

from main import app
from board import DEFAULT_BOARD

FRESH_BOARD = {
    "columns": [
        {"id": "col-backlog", "title": "Backlog", "cardIds": []},
        {"id": "col-discovery", "title": "Discovery", "cardIds": []},
        {"id": "col-progress", "title": "In Progress", "cardIds": []},
        {"id": "col-review", "title": "Review", "cardIds": []},
        {"id": "col-done", "title": "Done", "cardIds": []},
    ],
    "cards": {},
}


def login(client):
    resp = client.post("/api/login", json={"username": "user", "password": "password"})
    assert resp.status_code == 200


def test_create_update_delete_card_flow(client):
    login(client)

    # seed the board to a known clean state (fresh isolated DB per conftest)
    resp = client.put("/api/board", json=FRESH_BOARD)
    assert resp.status_code == 200

    resp = client.get("/api/board")
    assert resp.status_code == 200

    new_card = {"id": "card-test-1", "title": "Test Card", "details": "Details", "columnId": "col-backlog"}
    resp = client.post("/api/cards", json=new_card)
    assert resp.status_code == 200
    assert resp.json()["card"]["id"] == "card-test-1"

    resp = client.get("/api/board")
    board = resp.json()["board"]
    assert "card-test-1" in board["cards"]
    assert any("card-test-1" in c["cardIds"] for c in board["columns"])

    resp = client.patch("/api/cards/card-test-1", json={"columnId": "col-done", "position": 0})
    assert resp.status_code == 200
    assert resp.json()["card"]["id"] == "card-test-1"

    resp = client.get("/api/board")
    board = resp.json()["board"]
    assert any("card-test-1" in c["cardIds"] and c["id"] == "col-done" for c in board["columns"])

    resp = client.delete("/api/cards/card-test-1")
    assert resp.status_code == 200

    resp = client.get("/api/board")
    board = resp.json()["board"]
    assert "card-test-1" not in board["cards"]
    assert not any("card-test-1" in c["cardIds"] for c in board["columns"])
