import sqlite3
import json
import os
import threading
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone

import config
from security import hash_password

DB_FILENAME = os.path.join(os.path.dirname(__file__), "pm.db")

_local = threading.local()

SESSION_TTL_HOURS = 24

# A board's default Kanban layout. Kept here (rather than board.py) so the DB
# layer can seed new boards without a circular import; re-exported by board.py.
DEFAULT_BOARD = {
    "columns": [
        {"id": "col-backlog", "title": "Backlog", "cardIds": []},
        {"id": "col-discovery", "title": "Discovery", "cardIds": []},
        {"id": "col-progress", "title": "In Progress", "cardIds": []},
        {"id": "col-review", "title": "Review", "cardIds": []},
        {"id": "col-done", "title": "Done", "cardIds": []},
    ],
    "cards": {},
}


@contextmanager
def _conn(db_path: str | None = None):
    """Thread-local connection for the default DB; fresh connection for explicit paths (tests)."""
    path = db_path or DB_FILENAME
    if db_path is not None:
        conn = sqlite3.connect(path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
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
            _local.conn.execute("PRAGMA foreign_keys = ON")
            _local.db_path = path
        yield _local.conn


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _table_columns(conn, table: str) -> set[str]:
    return {row["name"] for row in conn.execute(f"PRAGMA table_info({table})")}


def _table_exists(conn, table: str) -> bool:
    row = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table,)
    ).fetchone()
    return row is not None


def init_db(db_path: str | None = None):
    with _conn(db_path) as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            """
        )
        _migrate_legacy(conn)
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS boards (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                owner_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                kanban_json TEXT NOT NULL,
                position INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS sessions (
                token TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                expires_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            CREATE TABLE IF NOT EXISTS board_members (
                board_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                role TEXT NOT NULL DEFAULT 'editor',
                created_at TEXT NOT NULL,
                PRIMARY KEY (board_id, user_id),
                FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS idx_boards_owner ON boards(owner_id);
            CREATE INDEX IF NOT EXISTS idx_members_user ON board_members(user_id);
            """
        )
        conn.commit()
        _seed_default_user(conn)


def _migrate_legacy(conn):
    """Migrate the original single-board / username-session schema to the new model."""
    # Legacy boards: (id, user_id TEXT, kanban_json, created_at, updated_at)
    if _table_exists(conn, "boards"):
        cols = _table_columns(conn, "boards")
        if "user_id" in cols and "owner_id" not in cols:
            legacy_rows = conn.execute(
                "SELECT user_id, kanban_json, created_at, updated_at FROM boards"
            ).fetchall()
            conn.execute("DROP TABLE boards")
            conn.execute(
                """
                CREATE TABLE boards (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    owner_id INTEGER NOT NULL,
                    name TEXT NOT NULL,
                    kanban_json TEXT NOT NULL,
                    position INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
                )
                """
            )
            for row in legacy_rows:
                username = row["user_id"]
                user = conn.execute(
                    "SELECT id FROM users WHERE username=?", (username,)
                ).fetchone()
                if user is None:
                    conn.execute(
                        "INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)",
                        (username, hash_password(config.VALID_PASSWORD), _now()),
                    )
                    owner_id = conn.execute(
                        "SELECT id FROM users WHERE username=?", (username,)
                    ).fetchone()["id"]
                else:
                    owner_id = user["id"]
                conn.execute(
                    """
                    INSERT INTO boards (owner_id, name, kanban_json, position, created_at, updated_at)
                    VALUES (?, ?, ?, 0, ?, ?)
                    """,
                    (owner_id, "My Board", row["kanban_json"], row["created_at"], row["updated_at"]),
                )

    # Legacy sessions keyed by username -> drop (forces re-login under new model).
    if _table_exists(conn, "sessions"):
        cols = _table_columns(conn, "sessions")
        if "username" in cols and "user_id" not in cols:
            conn.execute("DROP TABLE sessions")
    conn.commit()


def _seed_default_user(conn):
    """Ensure the configured default credentials exist as a user (idempotent)."""
    count = conn.execute("SELECT COUNT(*) AS n FROM users").fetchone()["n"]
    existing = conn.execute(
        "SELECT id FROM users WHERE username=?", (config.VALID_USERNAME,)
    ).fetchone()
    if existing is None:
        conn.execute(
            "INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)",
            (config.VALID_USERNAME, hash_password(config.VALID_PASSWORD), _now()),
        )
        conn.commit()


# --- Users ---------------------------------------------------------------

def create_user(username: str, password_hash: str, db_path: str | None = None) -> int:
    with _conn(db_path) as conn:
        cur = conn.execute(
            "INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)",
            (username, password_hash, _now()),
        )
        conn.commit()
        return cur.lastrowid


def get_user_by_username(username: str, db_path: str | None = None):
    with _conn(db_path) as conn:
        return conn.execute(
            "SELECT id, username, password_hash FROM users WHERE username=?", (username,)
        ).fetchone()


def get_user_by_id(user_id: int, db_path: str | None = None):
    with _conn(db_path) as conn:
        return conn.execute(
            "SELECT id, username FROM users WHERE id=?", (user_id,)
        ).fetchone()


# --- Boards --------------------------------------------------------------

def list_boards(owner_id: int, db_path: str | None = None) -> list[dict]:
    with _conn(db_path) as conn:
        rows = conn.execute(
            "SELECT id, name, position, created_at, updated_at FROM boards "
            "WHERE owner_id=? ORDER BY position, id",
            (owner_id,),
        ).fetchall()
    return [dict(r) for r in rows]


def create_board(owner_id: int, name: str, kanban_obj=None, db_path: str | None = None) -> int:
    now = _now()
    raw = json.dumps(kanban_obj if kanban_obj is not None else DEFAULT_BOARD)
    with _conn(db_path) as conn:
        next_pos = conn.execute(
            "SELECT COALESCE(MAX(position), -1) + 1 AS p FROM boards WHERE owner_id=?",
            (owner_id,),
        ).fetchone()["p"]
        cur = conn.execute(
            """
            INSERT INTO boards (owner_id, name, kanban_json, position, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (owner_id, name, raw, next_pos, now, now),
        )
        conn.commit()
        return cur.lastrowid


def get_board_row(board_id: int, db_path: str | None = None):
    with _conn(db_path) as conn:
        return conn.execute(
            "SELECT id, owner_id, name, kanban_json FROM boards WHERE id=?", (board_id,)
        ).fetchone()


def get_board_kanban(board_id: int, db_path: str | None = None):
    row = get_board_row(board_id, db_path)
    if not row:
        return None
    try:
        return json.loads(row["kanban_json"])
    except Exception:
        return None


def update_board_kanban(board_id: int, kanban_obj, db_path: str | None = None):
    with _conn(db_path) as conn:
        conn.execute(
            "UPDATE boards SET kanban_json=?, updated_at=? WHERE id=?",
            (json.dumps(kanban_obj), _now(), board_id),
        )
        conn.commit()


def rename_board(board_id: int, name: str, db_path: str | None = None):
    with _conn(db_path) as conn:
        conn.execute(
            "UPDATE boards SET name=?, updated_at=? WHERE id=?", (name, _now(), board_id)
        )
        conn.commit()


def delete_board(board_id: int, db_path: str | None = None):
    with _conn(db_path) as conn:
        conn.execute("DELETE FROM boards WHERE id=?", (board_id,))
        conn.commit()


def count_boards(owner_id: int, db_path: str | None = None) -> int:
    with _conn(db_path) as conn:
        return conn.execute(
            "SELECT COUNT(*) AS n FROM boards WHERE owner_id=?", (owner_id,)
        ).fetchone()["n"]


def list_accessible_boards(user_id: int, db_path: str | None = None) -> list[dict]:
    """Boards the user owns plus boards shared with them, tagged with role + owner."""
    with _conn(db_path) as conn:
        owned = conn.execute(
            "SELECT id, name, position, created_at, updated_at FROM boards "
            "WHERE owner_id=? ORDER BY position, id",
            (user_id,),
        ).fetchall()
        shared = conn.execute(
            """
            SELECT b.id, b.name, b.position, b.created_at, b.updated_at,
                   m.role AS role, u.username AS owner
            FROM board_members m
            JOIN boards b ON b.id = m.board_id
            JOIN users u ON u.id = b.owner_id
            WHERE m.user_id = ?
            ORDER BY b.position, b.id
            """,
            (user_id,),
        ).fetchall()
    result = [{**dict(r), "role": "owner", "owner": None} for r in owned]
    result.extend(dict(r) for r in shared)
    return result


def user_can_access_board(board_id: int, user_id: int, db_path: str | None = None) -> bool:
    with _conn(db_path) as conn:
        row = conn.execute(
            """
            SELECT 1 FROM boards WHERE id=? AND owner_id=?
            UNION
            SELECT 1 FROM board_members WHERE board_id=? AND user_id=?
            """,
            (board_id, user_id, board_id, user_id),
        ).fetchone()
    return row is not None


def add_board_member(board_id: int, user_id: int, role: str = "editor", db_path: str | None = None):
    with _conn(db_path) as conn:
        conn.execute(
            "INSERT OR IGNORE INTO board_members (board_id, user_id, role, created_at) "
            "VALUES (?, ?, ?, ?)",
            (board_id, user_id, role, _now()),
        )
        conn.commit()


def remove_board_member(board_id: int, user_id: int, db_path: str | None = None):
    with _conn(db_path) as conn:
        conn.execute(
            "DELETE FROM board_members WHERE board_id=? AND user_id=?", (board_id, user_id)
        )
        conn.commit()


def list_board_members(board_id: int, db_path: str | None = None) -> list[dict]:
    """Owner first (role='owner'), then editors, each with user_id + username."""
    with _conn(db_path) as conn:
        owner = conn.execute(
            "SELECT u.id AS user_id, u.username AS username FROM boards b "
            "JOIN users u ON u.id = b.owner_id WHERE b.id=?",
            (board_id,),
        ).fetchone()
        members = conn.execute(
            "SELECT u.id AS user_id, u.username AS username, m.role AS role "
            "FROM board_members m JOIN users u ON u.id = m.user_id "
            "WHERE m.board_id=? ORDER BY u.username",
            (board_id,),
        ).fetchall()
    result = []
    if owner:
        result.append({**dict(owner), "role": "owner"})
    result.extend(dict(m) for m in members)
    return result


def get_or_create_default_board(owner_id: int, db_path: str | None = None) -> int:
    with _conn(db_path) as conn:
        row = conn.execute(
            "SELECT id FROM boards WHERE owner_id=? ORDER BY position, id LIMIT 1",
            (owner_id,),
        ).fetchone()
        if row:
            return row["id"]
    return create_board(owner_id, "My Board", DEFAULT_BOARD, db_path)


# --- Sessions ------------------------------------------------------------

def create_session(token: str, user_id: int, db_path: str | None = None):
    expires_at = (datetime.now(timezone.utc) + timedelta(hours=SESSION_TTL_HOURS)).isoformat()
    with _conn(db_path) as conn:
        conn.execute(
            "INSERT OR REPLACE INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)",
            (token, user_id, expires_at),
        )
        conn.commit()


def get_session_user(token: str, db_path: str | None = None):
    """Return {'id', 'username'} for a valid, unexpired session, else None."""
    now = _now()
    with _conn(db_path) as conn:
        return conn.execute(
            """
            SELECT u.id AS id, u.username AS username
            FROM sessions s JOIN users u ON u.id = s.user_id
            WHERE s.token=? AND s.expires_at > ?
            """,
            (token, now),
        ).fetchone()


def delete_session(token: str, db_path: str | None = None):
    with _conn(db_path) as conn:
        conn.execute("DELETE FROM sessions WHERE token=?", (token,))
        conn.commit()


def delete_expired_sessions(db_path: str | None = None):
    with _conn(db_path) as conn:
        conn.execute("DELETE FROM sessions WHERE expires_at <= ?", (_now(),))
        conn.commit()
