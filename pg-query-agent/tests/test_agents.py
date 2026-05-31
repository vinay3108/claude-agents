"""Tests for query_builder and query_executor agents — SDK and DB are mocked."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from agents.query_builder import build_query, extract_sql
from agents.query_executor import execute_query
from tools.query_tool import GuardrailError


# ── extract_sql ────────────────────────────────────────────────────────────────

class TestExtractSql:
    def test_extracts_from_code_block(self):
        text = "Here is the query:\n```sql\nSELECT * FROM users\n```"
        assert extract_sql(text) == "SELECT * FROM users"

    def test_case_insensitive_sql_tag(self):
        text = "```SQL\nSELECT 1\n```"
        assert extract_sql(text) == "SELECT 1"

    def test_no_code_block_returns_raw(self):
        text = "SELECT id FROM users"
        assert extract_sql(text) == "SELECT id FROM users"

    def test_strips_whitespace(self):
        text = "```sql\n\n  SELECT 1  \n\n```"
        assert extract_sql(text) == "SELECT 1"

    def test_multiline_sql_preserved(self):
        sql = "SELECT id,\n  name\nFROM users\nLIMIT 50"
        text = f"```sql\n{sql}\n```"
        assert extract_sql(text) == sql


# ── build_query (Claude SDK mocked) ───────────────────────────────────────────

SCHEMA = "Table: users\nColumns:\n  id  integer  NOT NULL\n  name  text  NULL"


async def _fake_query(*, prompt, options):
    """Async generator that yields a single AssistantMessage with SQL."""
    from claude_code_sdk.types import AssistantMessage, TextBlock
    yield AssistantMessage(content=[TextBlock(text="```sql\nSELECT id, name FROM users LIMIT 50\n```")], model="claude-sonnet-4-6")


class TestBuildQuery:
    async def test_returns_sql_string(self):
        with patch("agents.query_builder.query", side_effect=_fake_query):
            result = await build_query("show me all users", SCHEMA, "users")
        assert result == "SELECT id, name FROM users LIMIT 50"

    async def test_unknown_message_type_ignored(self):
        async def _query_with_unknown_error(*, prompt, options):
            from claude_code_sdk.types import AssistantMessage, TextBlock
            yield AssistantMessage(content=[TextBlock(text="```sql\nSELECT 1\n```")], model="claude-sonnet-4-6")
            raise Exception("Unknown message type: rate_limit_event")

        with patch("agents.query_builder.query", side_effect=_query_with_unknown_error):
            result = await build_query("ping", SCHEMA, "users")
        assert result == "SELECT 1"

    async def test_real_sdk_error_propagates(self):
        async def _failing_query(*, prompt, options):
            raise RuntimeError("claude CLI not found")
            yield  # make it a generator

        with patch("agents.query_builder.query", side_effect=_failing_query):
            with pytest.raises(RuntimeError, match="claude CLI not found"):
                await build_query("anything", SCHEMA, "users")


# ── execute_query ──────────────────────────────────────────────────────────────

class TestExecuteQuery:
    def test_valid_sql_returns_rows(self):
        expected = [{"id": 1, "name": "Alice"}]
        with patch("agents.query_executor.PostgresReadOnlyQueryTool") as MockTool:
            MockTool.return_value.execute.return_value = expected
            result = execute_query("SELECT id, name FROM users LIMIT 50", {})
        assert result == expected

    def test_guardrail_error_propagates(self):
        with patch("agents.query_executor.PostgresReadOnlyQueryTool") as MockTool:
            MockTool.return_value.execute.side_effect = GuardrailError("Forbidden keyword: DELETE")
            with pytest.raises(GuardrailError, match="DELETE"):
                execute_query("DELETE FROM users", {})
