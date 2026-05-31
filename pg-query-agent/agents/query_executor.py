"""query_executor agent: validate SQL via guardrails then execute read-only."""

from typing import Any

from tools.query_tool import GuardrailError, PostgresReadOnlyQueryTool


def execute_query(sql: str, connection_params: dict[str, Any]) -> list[dict[str, Any]]:
    """
    Validate sql through the three-layer guardrail system, then run it
    inside a BEGIN TRANSACTION READ ONLY block.

    Raises GuardrailError if any safety check fails.
    Raises psycopg2.Error on database errors.
    """
    tool = PostgresReadOnlyQueryTool(connection_params)
    return tool.execute(sql)
