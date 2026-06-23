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


def test_card_metadata_fields(client):
    login(client)
    client.put("/api/board", json=FRESH_BOARD)

    created = client.post(
        "/api/cards",
        json={
            "id": "card-meta",
            "title": "Ship it",
            "details": "release",
            "columnId": "col-backlog",
            "priority": "high",
            "dueDate": "2026-07-01",
            "labels": ["release", "urgent"],
        },
    )
    assert created.status_code == 200
    card = created.json()["card"]
    assert card["priority"] == "high"
    assert card["dueDate"] == "2026-07-01"
    assert card["labels"] == ["release", "urgent"]

    # update clears priority and changes labels
    updated = client.patch(
        "/api/cards/card-meta",
        json={"priority": None, "labels": ["release"]},
    )
    assert updated.status_code == 200
    card = updated.json()["card"]
    assert "priority" not in card
    assert card["labels"] == ["release"]

    # the cleared/changed values survive a reload
    board = client.get("/api/board").json()["board"]
    stored = board["cards"]["card-meta"]
    assert "priority" not in stored
    assert stored["labels"] == ["release"]


def test_card_rejects_invalid_priority(client):
    login(client)
    client.put("/api/board", json=FRESH_BOARD)
    resp = client.post(
        "/api/cards",
        json={"title": "Bad", "columnId": "col-backlog", "priority": "urgent"},
    )
    assert resp.status_code == 422
