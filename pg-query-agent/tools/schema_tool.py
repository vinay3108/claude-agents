"""PostgreSQL schema inspection utilities."""

from typing import Any

import psycopg2
import psycopg2.extras


def get_table_schema(table: str, connection_params: dict[str, Any]) -> str:
    """Return a formatted schema string for the given table."""
    conn = psycopg2.connect(**connection_params)
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT column_name, data_type, is_nullable, column_default
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = %s
                ORDER BY ordinal_position
                """,
                (table,),
            )
            columns = cur.fetchall()

            cur.execute(
                """
                SELECT indexname, indexdef
                FROM pg_indexes
                WHERE schemaname = 'public' AND tablename = %s
                ORDER BY indexname
                """,
                (table,),
            )
            indexes = cur.fetchall()

            cur.execute(
                """
                SELECT conname, pg_get_constraintdef(oid) AS condef
                FROM pg_constraint
                WHERE conrelid = %s::regclass AND contype IN ('p','u','f')
                ORDER BY conname
                """,
                (f"public.{table}",),
            )
            constraints = cur.fetchall()

            return _format_schema(table, columns, indexes, constraints)
    finally:
        conn.close()


def list_tables(
    connection_params: dict[str, Any], pattern: str | None = None
) -> list[str]:
    """List all tables in the public schema, optionally filtered by pattern."""
    conn = psycopg2.connect(**connection_params)
    try:
        with conn.cursor() as cur:
            if pattern:
                cur.execute(
                    """
                    SELECT tablename FROM pg_tables
                    WHERE schemaname = 'public' AND tablename ILIKE %s
                    ORDER BY tablename
                    """,
                    (f"%{pattern}%",),
                )
            else:
                cur.execute(
                    """
                    SELECT tablename FROM pg_tables
                    WHERE schemaname = 'public'
                    ORDER BY tablename
                    """
                )
            return [row[0] for row in cur.fetchall()]
    finally:
        conn.close()


def _format_schema(
    table: str,
    columns: list,
    indexes: list,
    constraints: list,
) -> str:
    lines = [f"Table: {table}", "Columns:"]
    for col in columns:
        nullable = "NULL" if col["is_nullable"] == "YES" else "NOT NULL"
        default = f" DEFAULT {col['column_default']}" if col["column_default"] else ""
        lines.append(f"  {col['column_name']}  {col['data_type']}  {nullable}{default}")

    if constraints:
        lines.append("Constraints:")
        for c in constraints:
            lines.append(f"  {c['conname']}: {c['condef']}")

    if indexes:
        lines.append("Indexes:")
        for idx in indexes:
            lines.append(f"  {idx['indexname']}: {idx['indexdef']}")

    return "\n".join(lines)
