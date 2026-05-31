"""Tests for PostgresReadOnlyQueryTool — database calls are mocked."""

from unittest.mock import MagicMock, patch, call

import pytest

from tools.query_tool import GuardrailError, PostgresReadOnlyQueryTool


CONN_PARAMS = {
    "host": "localhost",
    "port": 5432,
    "dbname": "test",
    "user": "test",
    "password": "test",
}


def _make_mock_conn(rows: list[dict]):
    """Build a mock psycopg2 connection that returns `rows`."""
    mock_cursor = MagicMock()
    mock_cursor.__enter__ = lambda s: s
    mock_cursor.__exit__ = MagicMock(return_value=False)
    mock_cursor.fetchall.return_value = [dict(r) for r in rows]

    mock_conn = MagicMock()
    mock_conn.cursor.return_value = mock_cursor
    return mock_conn, mock_cursor


class TestExecute:
    def test_valid_select_returns_rows(self):
        rows = [{"id": 1, "name": "Alice"}, {"id": 2, "name": "Bob"}]
        mock_conn, mock_cursor = _make_mock_conn(rows)

        with patch("tools.query_tool.psycopg2.connect", return_value=mock_conn):
            tool = PostgresReadOnlyQueryTool(CONN_PARAMS)
            result = tool.execute("SELECT id, name FROM users LIMIT 50")

        assert result == rows

    def test_read_only_transaction_started(self):
        mock_conn, mock_cursor = _make_mock_conn([])

        with patch("tools.query_tool.psycopg2.connect", return_value=mock_conn):
            tool = PostgresReadOnlyQueryTool(CONN_PARAMS)
            tool.execute("SELECT 1")

        calls = [str(c) for c in mock_cursor.execute.call_args_list]
        assert any("READ ONLY" in c for c in calls)

    def test_rollback_always_called(self):
        mock_conn, _ = _make_mock_conn([])

        with patch("tools.query_tool.psycopg2.connect", return_value=mock_conn):
            tool = PostgresReadOnlyQueryTool(CONN_PARAMS)
            tool.execute("SELECT 1")

        mock_conn.rollback.assert_called_once()

    def test_connection_closed_on_success(self):
        mock_conn, _ = _make_mock_conn([])

        with patch("tools.query_tool.psycopg2.connect", return_value=mock_conn):
            tool = PostgresReadOnlyQueryTool(CONN_PARAMS)
            tool.execute("SELECT 1")

        mock_conn.close.assert_called_once()

    def test_connection_closed_on_db_error(self):
        mock_conn, mock_cursor = _make_mock_conn([])
        mock_cursor.execute.side_effect = Exception("db error")

        with patch("tools.query_tool.psycopg2.connect", return_value=mock_conn):
            tool = PostgresReadOnlyQueryTool(CONN_PARAMS)
            with pytest.raises(Exception, match="db error"):
                tool.execute("SELECT 1")

        mock_conn.close.assert_called_once()

    def test_invalid_sql_raises_guardrail_error(self):
        tool = PostgresReadOnlyQueryTool(CONN_PARAMS)
        with pytest.raises(GuardrailError):
            tool.execute("DELETE FROM users")

    def test_empty_result_returns_empty_list(self):
        mock_conn, _ = _make_mock_conn([])

        with patch("tools.query_tool.psycopg2.connect", return_value=mock_conn):
            tool = PostgresReadOnlyQueryTool(CONN_PARAMS)
            result = tool.execute("SELECT id FROM users WHERE 1=0 LIMIT 50")

        assert result == []
