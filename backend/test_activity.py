from fastapi.testclient import TestClient

from main import app


def make_client():
    return TestClient(app)


def owner_board(client):
    client.post("/api/login", json={"username": "user", "password": "password"})
    return client.get("/api/boards").json()["boards"][0]["id"]


def test_activity_records_card_and_comment_events(client):
    c = make_client()
    board_id = owner_board(c)

    c.post("/api/cards", json={"id": "card-a", "title": "Wireframes", "details": "", "columnId": "col-backlog"})
    c.post("/api/cards/card-a/comments", json={"text": "looks good"})
    c.delete("/api/cards/card-a")

    activity = c.get(f"/api/boards/{board_id}/activity").json()["activity"]
    actions = [a["action"] for a in activity]
    # newest first
    assert actions[0].startswith("deleted card")
    assert any("commented on" in a for a in actions)
    assert any("added card" in a for a in actions)
    assert all(a["actor"] == "user" for a in activity)


def test_activity_records_sharing(client):
    owner = make_client()
    board_id = owner_board(owner)

    member = make_client()
    member.post("/api/register", json={"username": "act_collab", "password": "password1"})
    member.post("/api/logout")

    owner.post(f"/api/boards/{board_id}/members", json={"username": "act_collab"})
    activity = owner.get(f"/api/boards/{board_id}/activity").json()["activity"]
    assert any("shared the board with act_collab" in a["action"] for a in activity)


def test_activity_requires_access(client):
    owner = make_client()
    board_id = owner_board(owner)
    owner.post("/api/logout")

    intruder = make_client()
    intruder.post("/api/register", json={"username": "act_intruder", "password": "password1"})
    assert intruder.get(f"/api/boards/{board_id}/activity").status_code == 404
