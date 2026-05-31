"""Tests for schema_tool — database calls are mocked."""

from unittest.mock import MagicMock, patch

import pytest

from tools.schema_tool import _format_schema, get_table_schema, list_tables


CONN_PARAMS = {"host": "localhost", "dbname": "test", "user": "test", "password": "test"}


def _mock_conn(fetchall_returns: list):
    """Mock that returns successive fetchall values."""
    call_count = {"n": 0}
    results = fetchall_returns

    mock_cursor = MagicMock()
    mock_cursor.__enter__ = lambda s: s
    mock_cursor.__exit__ = MagicMock(return_value=False)

    def fetchall_side_effect():
        val = results[call_count["n"]]
        call_count["n"] += 1
        return val

    mock_cursor.fetchall.side_effect = fetchall_side_effect

    mock_conn = MagicMock()
    mock_conn.cursor.return_value = mock_cursor
    return mock_conn


class TestFormatSchema:
    def test_basic_columns_formatted(self):
        columns = [
            {"column_name": "id", "data_type": "integer", "is_nullable": "NO", "column_default": None},
            {"column_name": "email", "data_type": "text", "is_nullable": "YES", "column_default": None},
        ]
        result = _format_schema("users", columns, [], [])
        assert "users" in result
        assert "id" in result
        assert "integer" in result
        assert "NOT NULL" in result
        assert "email" in result
        assert "NULL" in result

    def test_default_value_shown(self):
        columns = [
            {"column_name": "id", "data_type": "integer", "is_nullable": "NO", "column_default": "nextval('users_id_seq')"},
        ]
        result = _format_schema("users", columns, [], [])
        assert "nextval" in result

    def test_indexes_shown(self):
        indexes = [{"indexname": "users_pkey", "indexdef": "CREATE UNIQUE INDEX users_pkey ON users USING btree (id)"}]
        result = _format_schema("users", [], indexes, [])
        assert "users_pkey" in result

    def test_constraints_shown(self):
        constraints = [{"conname": "users_pkey", "condef": "PRIMARY KEY (id)"}]
        result = _format_schema("users", [], [], constraints)
        assert "PRIMARY KEY" in result

    def test_empty_table_no_crash(self):
        result = _format_schema("empty_table", [], [], [])
        assert "empty_table" in result


class TestListTables:
    def test_returns_table_names(self):
        mock_conn = _mock_conn([[("orders",), ("users",)]])
        with patch("tools.schema_tool.psycopg2.connect", return_value=mock_conn):
            result = list_tables(CONN_PARAMS)
        assert result == ["orders", "users"]

    def test_empty_schema_returns_empty_list(self):
        mock_conn = _mock_conn([[]])
        with patch("tools.schema_tool.psycopg2.connect", return_value=mock_conn):
            result = list_tables(CONN_PARAMS)
        assert result == []

    def test_pattern_filter_passed_to_query(self):
        mock_conn = _mock_conn([[("order_items",)]])
        with patch("tools.schema_tool.psycopg2.connect", return_value=mock_conn) as mock_connect:
            result = list_tables(CONN_PARAMS, pattern="order")
        assert result == ["order_items"]


class TestGetTableSchema:
    def test_returns_formatted_string(self):
        columns = [{"column_name": "id", "data_type": "integer", "is_nullable": "NO", "column_default": None}]
        mock_conn = _mock_conn([columns, [], []])
        with patch("tools.schema_tool.psycopg2.connect", return_value=mock_conn):
            result = get_table_schema("users", CONN_PARAMS)
        assert "users" in result
        assert "id" in result
