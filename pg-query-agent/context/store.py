"""SQLite-backed context store: caches table schemas and conversation history."""

import sqlite3
from dataclasses import dataclass
from pathlib import Path

DB_PATH = Path.home() / ".pg-query-agent" / "context.db"

_SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS schema_cache (
    table_name TEXT PRIMARY KEY,
    schema_text TEXT NOT NULL,
    cached_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS conversations (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL,
    question   TEXT NOT NULL,
    sql        TEXT,
    error      TEXT,
    row_count  INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
);
"""


@dataclass
class QueryRecord:
    question: str
    sql: str | None
    error: str | None
    row_count: int | None
    created_at: str


class ContextStore:
    """
    Persists schema and conversation history to SQLite at ~/.pg-query-agent/context.db.
    Each entry records the question, the generated SQL, and the outcome (rows / error).
    This history is injected into subsequent prompts so Claude avoids repeating mistakes.
    """

    def __init__(self, db_path: Path = DB_PATH):
        db_path.parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(str(db_path))
        self._conn.row_factory = sqlite3.Row
        self._conn.executescript(_SCHEMA_SQL)
        self._conn.commit()

    # ── schema cache ─────────────────────────────────────────────────────────

    def save_schema(self, table_name: str, schema_text: str) -> None:
        self._conn.execute(
            "INSERT OR REPLACE INTO schema_cache (table_name, schema_text) VALUES (?, ?)",
            (table_name, schema_text),
        )
        self._conn.commit()

    def get_schema(self, table_name: str) -> str | None:
        row = self._conn.execute(
            "SELECT schema_text FROM schema_cache WHERE table_name = ?",
            (table_name,),
        ).fetchone()
        return row["schema_text"] if row else None

    # ── conversation history ──────────────────────────────────────────────────

    def save_query(
        self,
        table_name: str,
        question: str,
        sql: str | None,
        error: str | None = None,
        row_count: int | None = None,
    ) -> None:
        self._conn.execute(
            """INSERT INTO conversations (table_name, question, sql, error, row_count)
               VALUES (?, ?, ?, ?, ?)""",
            (table_name, question, sql, error, row_count),
        )
        self._conn.commit()

    def get_history(self, table_name: str, limit: int = 10) -> list[QueryRecord]:
        rows = self._conn.execute(
            """SELECT question, sql, error, row_count, created_at
               FROM conversations
               WHERE table_name = ?
               ORDER BY id DESC
               LIMIT ?""",
            (table_name, limit),
        ).fetchall()
        return [QueryRecord(**dict(r)) for r in reversed(rows)]

    def format_history_for_prompt(self, table_name: str, limit: int = 8) -> str:
        """Return a concise history block ready to inject into the Claude prompt."""
        history = self.get_history(table_name, limit)
        if not history:
            return ""

        lines = ["--- Conversation history for this table ---"]
        for i, rec in enumerate(history, 1):
            lines.append(f"[{i}] Question: {rec.question}")
            if rec.sql:
                lines.append(f"    SQL: {rec.sql}")
            if rec.error:
                lines.append(f"    OUTCOME: ERROR — {rec.error}")
            elif rec.row_count is not None:
                lines.append(f"    OUTCOME: {rec.row_count} row(s) returned")
        lines.append("--- End of history ---")
        return "\n".join(lines)

    def close(self) -> None:
        self._conn.close()

    def __enter__(self):
        return self

    def __exit__(self, *_):
        self.close()
