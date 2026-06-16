import sqlite3
import json
import os
from datetime import datetime

DB_FILENAME = os.path.join(os.path.dirname(__file__), "pm.db")


def get_conn(db_path: str | None = None):
    path = db_path or DB_FILENAME
    conn = sqlite3.connect(path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db(db_path: str | None = None):
    conn = get_conn(db_path)
    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS boards (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT UNIQUE NOT NULL,
            kanban_json TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """
    )
    conn.commit()
    conn.close()


def get_board(user_id: str, db_path: str | None = None):
    conn = get_conn(db_path)
    cur = conn.cursor()
    cur.execute("SELECT kanban_json FROM boards WHERE user_id = ?", (user_id,))
    row = cur.fetchone()
    conn.close()
    if not row:
        return None
    try:
        return json.loads(row["kanban_json"])
    except Exception:
        return None


def upsert_board(user_id: str, board_obj, db_path: str | None = None):
    now = datetime.utcnow().isoformat() + "Z"
    raw = json.dumps(board_obj)
    conn = get_conn(db_path)
    cur = conn.cursor()
    cur.execute("SELECT id FROM boards WHERE user_id = ?", (user_id,))
    row = cur.fetchone()
    if row:
        cur.execute(
            "UPDATE boards SET kanban_json = ?, updated_at = ? WHERE user_id = ?",
            (raw, now, user_id),
        )
    else:
        cur.execute(
            "INSERT INTO boards (user_id, kanban_json, created_at, updated_at) VALUES (?, ?, ?, ?)",
            (user_id, raw, now, now),
        )
    conn.commit()
    conn.close()
