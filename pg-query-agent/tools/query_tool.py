"""Read-only PostgreSQL query execution with a three-layer guardrail system."""

from typing import Any

import psycopg2
import psycopg2.extras
import sqlparse
import sqlparse.tokens as T


class GuardrailError(ValueError):
    pass


class GuardrailValidator:
    """Three-layer safety check before any SQL reaches the database."""

    FORBIDDEN = {
        "INSERT", "UPDATE", "DELETE", "DROP", "CREATE", "ALTER",
        "TRUNCATE", "GRANT", "REVOKE", "EXECUTE", "CALL", "MERGE",
        "REPLACE", "UPSERT",
    }

    def validate(self, sql: str) -> tuple[bool, str]:
        sql = sql.strip()
        if not sql:
            return False, "Empty query"

        parsed = sqlparse.parse(sql)
        if not parsed or not parsed[0].tokens:
            return False, "Failed to parse SQL"

        stmt = parsed[0]

        # Layer 1 — sqlparse statement type must be SELECT
        stmt_type = stmt.get_type()
        if stmt_type != "SELECT":
            return False, f"Only SELECT allowed, got: {stmt_type or 'UNKNOWN'}"

        # Layer 2 — scan tokens for forbidden DML/DDL keywords
        for token in stmt.flatten():
            if token.ttype in (T.Keyword, T.Keyword.DDL, T.Keyword.DML):
                if token.normalized.upper() in self.FORBIDDEN:
                    return False, f"Forbidden keyword: {token.normalized.upper()}"

        return True, "OK"


class PostgresReadOnlyQueryTool:
    """Execute validated SELECT queries inside a read-only transaction."""

    def __init__(self, connection_params: dict[str, Any]):
        self.connection_params = connection_params
        self.validator = GuardrailValidator()

    def execute(self, sql: str) -> list[dict[str, Any]]:
        valid, reason = self.validator.validate(sql)
        if not valid:
            raise GuardrailError(reason)

        conn = psycopg2.connect(**self.connection_params)
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                # Layer 3 — database engine enforces read-only at transaction level
                cur.execute("BEGIN TRANSACTION READ ONLY")
                cur.execute(sql)
                rows = cur.fetchall()
                conn.rollback()
                return [dict(row) for row in rows]
        finally:
            conn.close()
