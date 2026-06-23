def login(client, username="user", password="password"):
    resp = client.post("/api/login", json={"username": username, "password": password})
    assert resp.status_code == 200


def test_default_board_listed(client):
    login(client)
    boards = client.get("/api/boards").json()["boards"]
    assert len(boards) == 1
    assert boards[0]["name"] == "My Board"


def test_create_list_rename_delete_board(client):
    login(client)

    created = client.post("/api/boards", json={"name": "Roadmap"})
    assert created.status_code == 201
    board_id = created.json()["board"]["id"]

    boards = client.get("/api/boards").json()["boards"]
    assert {b["name"] for b in boards} == {"My Board", "Roadmap"}

    renamed = client.patch(f"/api/boards/{board_id}", json={"name": "Q3 Roadmap"})
    assert renamed.status_code == 200
    names = {b["name"] for b in client.get("/api/boards").json()["boards"]}
    assert "Q3 Roadmap" in names

    deleted = client.delete(f"/api/boards/{board_id}")
    assert deleted.status_code == 200
    names = {b["name"] for b in client.get("/api/boards").json()["boards"]}
    assert "Q3 Roadmap" not in names


def test_cards_scoped_to_board(client):
    login(client)
    board_id = client.post("/api/boards", json={"name": "Second"}).json()["board"]["id"]

    # add a card to the second board
    resp = client.post(
        f"/api/cards?board_id={board_id}",
        json={"title": "Scoped card", "details": "", "columnId": "col-backlog"},
    )
    assert resp.status_code == 200

    # second board has the card; default board does not
    scoped = client.get(f"/api/board?board_id={board_id}").json()["board"]
    assert any(c["title"] == "Scoped card" for c in scoped["cards"].values())
    default = client.get("/api/board").json()["board"]
    assert default["cards"] == {}


def test_cannot_access_other_users_board(client):
    login(client)
    board_id = client.post("/api/boards", json={"name": "Private"}).json()["board"]["id"]
    client.post("/api/logout")

    client.post("/api/register", json={"username": "intruder", "password": "password1"})
    assert client.get(f"/api/board?board_id={board_id}").status_code == 404
    assert client.patch(f"/api/boards/{board_id}", json={"name": "Hacked"}).status_code == 404
    assert client.delete(f"/api/boards/{board_id}").status_code == 404


def test_board_endpoints_require_auth(client):
    assert client.get("/api/boards").status_code == 401
    assert client.post("/api/boards", json={"name": "x"}).status_code == 401
    assert client.get("/api/board").status_code == 401
