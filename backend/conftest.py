import pytest
from fastapi.testclient import TestClient


@pytest.fixture(autouse=True)
def isolate_db(monkeypatch, tmp_path):
    """Give every test its own isolated SQLite database (and no rate limiting)."""
    test_db = str(tmp_path / "test.db")
    monkeypatch.setattr("db.DB_FILENAME", test_db)
    import db as db_module
    # Force a new thread-local connection to the fresh test DB
    import threading
    db_module._local = threading.local()
    db_module.init_db(test_db)

    # Disable the shared rate limiter so per-IP counters don't bleed across tests.
    import config
    monkeypatch.setattr(config.limiter, "enabled", False)
    yield test_db


@pytest.fixture
def client():
    from main import app
    return TestClient(app)
