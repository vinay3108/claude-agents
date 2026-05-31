"""Tests for GuardrailValidator — no database connection needed."""

import pytest

from tools.query_tool import GuardrailValidator


@pytest.fixture
def validator():
    return GuardrailValidator()


class TestLayer1SelectCheck:
    def test_valid_select_passes(self, validator):
        ok, msg = validator.validate("SELECT id, name FROM users LIMIT 50")
        assert ok is True
        assert msg == "OK"

    def test_select_with_where_passes(self, validator):
        ok, _ = validator.validate("SELECT * FROM orders WHERE status = 'active' LIMIT 50")
        assert ok is True

    def test_select_with_join_passes(self, validator):
        sql = "SELECT u.id, o.total FROM users u JOIN orders o ON u.id = o.user_id LIMIT 50"
        ok, _ = validator.validate(sql)
        assert ok is True

    def test_empty_query_blocked(self, validator):
        ok, msg = validator.validate("")
        assert ok is False
        assert "Empty" in msg

    def test_whitespace_only_blocked(self, validator):
        ok, msg = validator.validate("   ")
        assert ok is False

    def test_insert_blocked(self, validator):
        ok, msg = validator.validate("INSERT INTO users (name) VALUES ('evil')")
        assert ok is False
        assert "INSERT" in msg or "SELECT" in msg

    def test_update_blocked(self, validator):
        ok, msg = validator.validate("UPDATE users SET name='hacked' WHERE id=1")
        assert ok is False

    def test_delete_blocked(self, validator):
        ok, msg = validator.validate("DELETE FROM users WHERE id=1")
        assert ok is False

    def test_drop_blocked(self, validator):
        ok, msg = validator.validate("DROP TABLE users")
        assert ok is False

    def test_create_blocked(self, validator):
        ok, msg = validator.validate("CREATE TABLE evil (id serial)")
        assert ok is False

    def test_alter_blocked(self, validator):
        ok, msg = validator.validate("ALTER TABLE users ADD COLUMN evil text")
        assert ok is False

    def test_truncate_blocked(self, validator):
        ok, msg = validator.validate("TRUNCATE TABLE users")
        assert ok is False


class TestLayer2KeywordScan:
    def test_select_with_subquery_insert_blocked(self, validator):
        sql = "SELECT * FROM (INSERT INTO foo VALUES (1)) AS t"
        ok, _ = validator.validate(sql)
        assert ok is False

    def test_grant_blocked(self, validator):
        ok, _ = validator.validate("GRANT ALL ON users TO evil_user")
        assert ok is False

    def test_execute_blocked(self, validator):
        ok, _ = validator.validate("EXECUTE drop_all_tables()")
        assert ok is False


class TestEdgeCases:
    def test_case_insensitive_select(self, validator):
        ok, _ = validator.validate("select id from users limit 10")
        assert ok is True

    def test_multiline_select(self, validator):
        sql = """
        SELECT
            id,
            name,
            email
        FROM users
        WHERE active = true
        LIMIT 50
        """
        ok, _ = validator.validate(sql)
        assert ok is True

    def test_cannot_answer_comment_passes(self, validator):
        # Claude may return this when schema can't answer the question
        ok, _ = validator.validate("-- CANNOT_ANSWER: column not in schema")
        assert ok is False  # comments alone are not SELECT statements
