from security import hash_password, verify_password


def test_password_hash_roundtrip():
    h = hash_password("s3cret-pw")
    assert h != "s3cret-pw"
    assert verify_password("s3cret-pw", h)
    assert not verify_password("wrong", h)
    assert not verify_password("s3cret-pw", "not-a-valid-hash")


def test_register_creates_user_and_session(client):
    resp = client.post("/api/register", json={"username": "alice", "password": "password1"})
    assert resp.status_code == 201
    assert resp.json()["username"] == "alice"
    assert "session_token" in resp.cookies

    auth = client.get("/api/auth-status")
    assert auth.json() == {"authenticated": True, "username": "alice"}

    # A default board is provisioned on registration.
    boards = client.get("/api/boards").json()["boards"]
    assert len(boards) == 1


def test_register_rejects_duplicate_username(client):
    client.post("/api/register", json={"username": "bob", "password": "password1"})
    fresh = client.post("/api/register", json={"username": "bob", "password": "password2"})
    assert fresh.status_code == 409


def test_register_validates_input(client):
    too_short_user = client.post("/api/register", json={"username": "ab", "password": "password1"})
    assert too_short_user.status_code == 422
    too_short_pw = client.post("/api/register", json={"username": "carol", "password": "123"})
    assert too_short_pw.status_code == 422
    bad_chars = client.post("/api/register", json={"username": "has space", "password": "password1"})
    assert bad_chars.status_code == 422


def test_registered_user_can_login(client):
    client.post("/api/register", json={"username": "dave", "password": "password1"})
    client.post("/api/logout")
    login = client.post("/api/login", json={"username": "dave", "password": "password1"})
    assert login.status_code == 200
    assert client.get("/api/auth-status").json()["username"] == "dave"


def test_data_is_isolated_between_users(client):
    # alice creates a card on her default board
    client.post("/api/register", json={"username": "alice2", "password": "password1"})
    client.post("/api/cards", json={"title": "Alice card", "details": "", "columnId": "col-backlog"})
    client.post("/api/logout")

    # bob sees a clean default board
    client.post("/api/register", json={"username": "bob2", "password": "password1"})
    board = client.get("/api/board").json()["board"]
    assert board["cards"] == {}
