from fastapi.testclient import TestClient

from main import app


def make_client():
    return TestClient(app)


def register(client, username, password="password1"):
    resp = client.post("/api/register", json={"username": username, "password": password})
    assert resp.status_code == 201


def owner_board(client):
    """Log in as the seeded owner and return their default board id."""
    client.post("/api/login", json={"username": "user", "password": "password"})
    return client.get("/api/boards").json()["boards"][0]["id"]


def test_owner_can_share_and_member_can_access(client):
    # Owner session
    owner = make_client()
    board_id = owner_board(owner)
    # seed a card so we can verify the member sees real data
    owner.post("/api/cards", json={"title": "Shared task", "details": "", "columnId": "col-backlog"})

    # Create the collaborator
    member = make_client()
    register(member, "collab")
    member.post("/api/logout")

    # Owner shares the board with collab
    shared = owner.post(f"/api/boards/{board_id}/members", json={"username": "collab"})
    assert shared.status_code == 201
    usernames = {m["username"] for m in shared.json()["members"]}
    assert {"user", "collab"} <= usernames

    # Collab logs in and sees the shared board (tagged with role + owner)
    member.post("/api/login", json={"username": "collab", "password": "password1"})
    boards = member.get("/api/boards").json()["boards"]
    shared_entry = next((b for b in boards if b["id"] == board_id), None)
    assert shared_entry is not None
    assert shared_entry["role"] == "editor"
    assert shared_entry["owner"] == "user"

    # Collab can read and edit the shared board
    board = member.get(f"/api/board?board_id={board_id}").json()["board"]
    assert any(c["title"] == "Shared task" for c in board["cards"].values())
    edit = member.post(
        f"/api/cards?board_id={board_id}",
        json={"title": "Collab card", "details": "", "columnId": "col-backlog"},
    )
    assert edit.status_code == 200


def test_member_cannot_manage_or_delete_board(client):
    owner = make_client()
    board_id = owner_board(owner)

    member = make_client()
    register(member, "collab2")
    member.post("/api/logout")
    owner.post(f"/api/boards/{board_id}/members", json={"username": "collab2"})

    member.post("/api/login", json={"username": "collab2", "password": "password1"})
    # Members are editors, not owners: cannot add members, rename, or delete
    assert member.post(f"/api/boards/{board_id}/members", json={"username": "user"}).status_code == 404
    assert member.patch(f"/api/boards/{board_id}", json={"name": "Hijack"}).status_code == 404
    assert member.delete(f"/api/boards/{board_id}").status_code == 404


def test_owner_can_revoke_access(client):
    owner = make_client()
    board_id = owner_board(owner)

    member = make_client()
    register(member, "collab3")
    member.post("/api/logout")
    owner.post(f"/api/boards/{board_id}/members", json={"username": "collab3"})

    # Find collab3's user id from the member list
    members = owner.get(f"/api/boards/{board_id}/members").json()["members"]
    collab_id = next(m["user_id"] for m in members if m["username"] == "collab3")

    removed = owner.delete(f"/api/boards/{board_id}/members/{collab_id}")
    assert removed.status_code == 200

    # collab3 no longer has access
    member.post("/api/login", json={"username": "collab3", "password": "password1"})
    assert member.get(f"/api/board?board_id={board_id}").status_code == 404
    assert all(b["id"] != board_id for b in member.get("/api/boards").json()["boards"])


def test_share_with_unknown_user_returns_404(client):
    owner = make_client()
    board_id = owner_board(owner)
    resp = owner.post(f"/api/boards/{board_id}/members", json={"username": "ghost"})
    assert resp.status_code == 404
