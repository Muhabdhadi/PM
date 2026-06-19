import sqlite3
import json
import os
import threading
from contextlib import contextmanager
from datetime import datetime, timezone

DB_FILENAME = os.path.join(os.path.dirname(__file__), "pm.db")

_local = threading.local()


@contextmanager
def _conn(db_path: str | None = None):
    """Thread-local connection for the default DB; fresh connection for explicit paths (tests)."""
    path = db_path or DB_FILENAME
    if db_path is not None:
        conn = sqlite3.connect(path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()
    else:
        if not hasattr(_local, "conn") or _local.db_path != path:
            if hasattr(_local, "conn") and _local.conn:
                try:
                    _local.conn.close()
                except Exception:
                    pass
            _local.conn = sqlite3.connect(path, check_same_thread=False)
            _local.conn.row_factory = sqlite3.Row
            _local.db_path = path
        yield _local.conn


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def init_db(db_path: str | None = None):
    with _conn(db_path) as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS boards (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT UNIQUE NOT NULL,
                kanban_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS sessions (
                token TEXT PRIMARY KEY,
                username TEXT NOT NULL,
                expires_at TEXT NOT NULL
            );
            """
        )
        conn.commit()


def get_board(user_id: str, db_path: str | None = None):
    with _conn(db_path) as conn:
        row = conn.execute(
            "SELECT kanban_json FROM boards WHERE user_id = ?", (user_id,)
        ).fetchone()
    if not row:
        return None
    try:
        return json.loads(row["kanban_json"])
    except Exception:
        return None


def upsert_board(user_id: str, board_obj, db_path: str | None = None):
    now = _now()
    raw = json.dumps(board_obj)
    with _conn(db_path) as conn:
        conn.execute(
            """
            INSERT INTO boards (user_id, kanban_json, created_at, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET kanban_json = excluded.kanban_json,
                                                updated_at = excluded.updated_at
            """,
            (user_id, raw, now, now),
        )
        conn.commit()


# --- Session management (C-3, M-5) ---

SESSION_TTL_HOURS = 24


def create_session(token: str, username: str, db_path: str | None = None):
    from datetime import timedelta
    expires_at = (datetime.now(timezone.utc) + timedelta(hours=SESSION_TTL_HOURS)).isoformat()
    with _conn(db_path) as conn:
        conn.execute(
            "INSERT OR REPLACE INTO sessions (token, username, expires_at) VALUES (?, ?, ?)",
            (token, username, expires_at),
        )
        conn.commit()


def get_session_username(token: str, db_path: str | None = None) -> str | None:
    now = _now()
    with _conn(db_path) as conn:
        row = conn.execute(
            "SELECT username FROM sessions WHERE token = ? AND expires_at > ?",
            (token, now),
        ).fetchone()
    return row["username"] if row else None


def delete_session(token: str, db_path: str | None = None):
    with _conn(db_path) as conn:
        conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
        conn.commit()


def delete_expired_sessions(db_path: str | None = None):
    now = _now()
    with _conn(db_path) as conn:
        conn.execute("DELETE FROM sessions WHERE expires_at <= ?", (now,))
        conn.commit()
