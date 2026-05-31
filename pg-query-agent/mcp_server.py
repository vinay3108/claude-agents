"""
MCP server for pg-query-agent.

Exposes three tools:
  - query        — natural language → SQL → results
  - list_tables  — list tables in the public schema
  - get_schema   — return formatted schema for a table

Run via stdio (default for Claude Code MCP):
    python mcp_server.py
"""

import asyncio
import json
import os
import sys
from pathlib import Path
from typing import Any

# ── resolve project root and add it to sys.path ──────────────────────────────
PROJECT_ROOT = Path(__file__).parent
sys.path.insert(0, str(PROJECT_ROOT))

# ── load .env from the project directory ─────────────────────────────────────
from dotenv import load_dotenv  # noqa: E402

load_dotenv(PROJECT_ROOT / ".env")

# ── project imports ───────────────────────────────────────────────────────────
from agents.query_builder import build_query  # noqa: E402
from agents.query_executor import execute_query  # noqa: E402
from context.store import ContextStore  # noqa: E402
from mcp.server.fastmcp import FastMCP  # noqa: E402
from tools.query_tool import GuardrailError  # noqa: E402
from tools.schema_tool import get_table_schema  # noqa: E402
from tools.schema_tool import list_tables as _list_tables  # noqa: E402

# ── MCP server instance ───────────────────────────────────────────────────────
mcp = FastMCP("pg-query-agent")

# ── helpers ───────────────────────────────────────────────────────────────────

_REQUIRED_ENV_VARS = (
    "DATABASE_HOST",
    "DATABASE_PORT",
    "DATABASE_NAME",
    "DATABASE_USER",
    "DATABASE_PASSWORD",
)


def _build_connection_params() -> dict[str, Any]:
    """Read DB credentials from environment and return a psycopg2-compatible dict."""
    missing = [v for v in _REQUIRED_ENV_VARS if not os.environ.get(v)]
    if missing:
        raise EnvironmentError(
            f"Missing required environment variable(s): {', '.join(missing)}. "
            f"Ensure they are set in {PROJECT_ROOT / '.env'}"
        )
    return {
        "host": os.environ["DATABASE_HOST"],
        "port": int(os.environ["DATABASE_PORT"]),
        "dbname": os.environ["DATABASE_NAME"],
        "user": os.environ["DATABASE_USER"],
        "password": os.environ["DATABASE_PASSWORD"],
    }


def _get_or_fetch_schema(store: ContextStore, table: str, connection_params: dict) -> str:
    """Return schema from cache, or fetch from DB and cache it."""
    cached = store.get_schema(table)
    if cached:
        return cached
    schema = get_table_schema(table, connection_params)
    store.save_schema(table, schema)
    return schema


# ── MCP tools ─────────────────────────────────────────────────────────────────

@mcp.tool()
async def query(table: str, question: str) -> str:
    """
    Convert a natural language question into a SQL SELECT and execute it.

    Args:
        table:    The PostgreSQL table to query.
        question: Natural language question (e.g. "how many orders last week").

    Returns:
        JSON string with keys: sql, rows, row_count  — or error, sql on failure.
    """
    connection_params = _build_connection_params()

    with ContextStore() as store:
        schema = _get_or_fetch_schema(store, table, connection_params)
        history = store.format_history_for_prompt(table)

        sql = await build_query(question, schema, table, history=history)

        try:
            rows = execute_query(sql, connection_params)
            store.save_query(
                table_name=table,
                question=question,
                sql=sql,
                row_count=len(rows),
            )
            return json.dumps({"sql": sql, "rows": rows, "row_count": len(rows)})

        except GuardrailError as exc:
            store.save_query(
                table_name=table,
                question=question,
                sql=sql,
                error=str(exc),
            )
            return json.dumps({"error": f"Guardrail blocked: {exc}", "sql": sql})

        except Exception as exc:  # psycopg2 errors, etc.
            store.save_query(
                table_name=table,
                question=question,
                sql=sql,
                error=str(exc),
            )
            return json.dumps({"error": str(exc), "sql": sql})


@mcp.tool()
def list_tables(pattern: str = "") -> str:
    """
    List all tables in the public schema, optionally filtered by a pattern.

    Args:
        pattern: Optional substring to filter table names (case-insensitive).

    Returns:
        JSON string with key: tables (list of table name strings).
    """
    connection_params = _build_connection_params()
    tables = _list_tables(connection_params, pattern or None)
    return json.dumps({"tables": tables})


@mcp.tool()
def get_schema(table: str) -> str:
    """
    Return the formatted schema for a PostgreSQL table.

    Checks the local SQLite cache first; fetches from the DB if not cached.

    Args:
        table: Table name to inspect.

    Returns:
        JSON string with keys: table, schema.
    """
    connection_params = _build_connection_params()

    with ContextStore() as store:
        schema = _get_or_fetch_schema(store, table, connection_params)

    return json.dumps({"table": table, "schema": schema})


# ── entrypoint ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    mcp.run()
