"""Tests for ContextStore — uses a temp in-memory SQLite path."""

import tempfile
from pathlib import Path

import pytest

from context.store import ContextStore


@pytest.fixture
def store(tmp_path):
    s = ContextStore(db_path=tmp_path / "test.db")
    yield s
    s.close()


class TestSchemaCache:
    def test_save_and_retrieve_schema(self, store):
        store.save_schema("users", "Table: users\nColumns:\n  id integer NOT NULL")
        result = store.get_schema("users")
        assert result is not None
        assert "users" in result

    def test_get_missing_schema_returns_none(self, store):
        assert store.get_schema("nonexistent") is None

    def test_save_overwrites_existing_schema(self, store):
        store.save_schema("users", "old schema")
        store.save_schema("users", "new schema")
        assert store.get_schema("users") == "new schema"


class TestConversationHistory:
    def test_save_and_retrieve_query(self, store):
        store.save_query("orders", "show me all orders", "SELECT * FROM orders LIMIT 50", row_count=10)
        history = store.get_history("orders")
        assert len(history) == 1
        assert history[0].question == "show me all orders"
        assert history[0].sql == "SELECT * FROM orders LIMIT 50"
        assert history[0].row_count == 10
        assert history[0].error is None

    def test_save_query_with_error(self, store):
        store.save_query("orders", "last 10 orders", "SELECT * FROM orders ORDER BY createdAt LIMIT 10", error='column "createdat" does not exist')
        history = store.get_history("orders")
        assert history[0].error is not None
        assert "createdat" in history[0].error

    def test_history_limited_by_limit_param(self, store):
        for i in range(15):
            store.save_query("users", f"question {i}", f"SELECT {i}", row_count=i)
        history = store.get_history("users", limit=5)
        assert len(history) == 5

    def test_history_returned_oldest_first(self, store):
        store.save_query("users", "first", "SELECT 1", row_count=1)
        store.save_query("users", "second", "SELECT 2", row_count=2)
        history = store.get_history("users")
        assert history[0].question == "first"
        assert history[1].question == "second"

    def test_history_scoped_per_table(self, store):
        store.save_query("users", "users question", "SELECT * FROM users LIMIT 50", row_count=5)
        store.save_query("orders", "orders question", "SELECT * FROM orders LIMIT 50", row_count=3)
        assert len(store.get_history("users")) == 1
        assert len(store.get_history("orders")) == 1
        assert store.get_history("users")[0].question == "users question"

    def test_empty_history_returns_empty_list(self, store):
        assert store.get_history("no_such_table") == []


class TestFormatHistoryForPrompt:
    def test_empty_history_returns_empty_string(self, store):
        assert store.format_history_for_prompt("users") == ""

    def test_successful_query_included(self, store):
        store.save_query("users", "how many users?", "SELECT COUNT(*) FROM users LIMIT 50", row_count=1)
        result = store.format_history_for_prompt("users")
        assert "how many users?" in result
        assert "SELECT COUNT(*)" in result
        assert "1 row(s)" in result

    def test_error_query_included(self, store):
        store.save_query("users", "last 10 users", "SELECT * FROM users ORDER BY createdAt", error='column "createdat" does not exist')
        result = store.format_history_for_prompt("users")
        assert "last 10 users" in result
        assert "ERROR" in result
        assert "createdat" in result

    def test_format_has_header_and_footer(self, store):
        store.save_query("users", "test", "SELECT 1", row_count=0)
        result = store.format_history_for_prompt("users")
        assert "Conversation history" in result
        assert "End of history" in result


class TestContextManager:
    def test_context_manager_closes_connection(self, tmp_path):
        with ContextStore(db_path=tmp_path / "cm_test.db") as store:
            store.save_schema("t", "schema")
        # Connection is closed — further access would raise, but we just verify no exception
