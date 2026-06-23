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
            "assignee": "alice",
        },
    )
    assert created.status_code == 200
    card = created.json()["card"]
    assert card["priority"] == "high"
    assert card["dueDate"] == "2026-07-01"
    assert card["labels"] == ["release", "urgent"]
    assert card["assignee"] == "alice"

    # update clears priority and changes labels and assignee
    updated = client.patch(
        "/api/cards/card-meta",
        json={"priority": None, "labels": ["release"], "assignee": "bob"},
    )
    assert updated.status_code == 200
    card = updated.json()["card"]
    assert "priority" not in card
    assert card["labels"] == ["release"]
    assert card["assignee"] == "bob"

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


def test_add_comment_to_card(client):
    login(client)
    client.put("/api/board", json=FRESH_BOARD)
    client.post(
        "/api/cards",
        json={"id": "card-c", "title": "Discuss", "details": "", "columnId": "col-backlog"},
    )

    resp = client.post("/api/cards/card-c/comments", json={"text": "First!"})
    assert resp.status_code == 201
    comment = resp.json()["comment"]
    assert comment["text"] == "First!"
    assert comment["author"] == "user"
    assert comment["id"].startswith("cmt-")
    assert comment["createdAt"]

    # a second comment accumulates and the card persists them
    client.post("/api/cards/card-c/comments", json={"text": "Second"})
    board = client.get("/api/board").json()["board"]
    comments = board["cards"]["card-c"]["comments"]
    assert [c["text"] for c in comments] == ["First!", "Second"]


def test_add_comment_when_card_has_null_comments(client):
    """A board saved via PUT serializes card.comments as null; commenting must still work."""
    login(client)
    board = {
        "columns": [{"id": "col-backlog", "title": "Backlog", "cardIds": ["card-n"]}],
        "cards": {"card-n": {"id": "card-n", "title": "T", "details": "", "comments": None}},
    }
    assert client.put("/api/board", json=board).status_code == 200
    resp = client.post("/api/cards/card-n/comments", json={"text": "works"})
    assert resp.status_code == 201
    assert resp.json()["comments"][0]["text"] == "works"


def test_add_comment_validates_and_404s(client):
    login(client)
    client.put("/api/board", json=FRESH_BOARD)
    assert client.post("/api/cards/missing/comments", json={"text": "hi"}).status_code == 404
    client.post(
        "/api/cards",
        json={"id": "card-d", "title": "X", "details": "", "columnId": "col-backlog"},
    )
    assert client.post("/api/cards/card-d/comments", json={"text": ""}).status_code == 422
