# pg-query-agent

A natural language PostgreSQL query tool — available as both an **interactive CLI** and an **MCP server** you can call from any AI assistant (Kiro, Claude Code, etc.).

Type a question, get results. Claude handles the SQL.

```
Table: orders> show me the last 10 orders by total amount
SQL → SELECT "id", "userId", "total", "createdAt" FROM "orders" ORDER BY "total" DESC LIMIT 10

 id  │ userId │ total  │ createdAt
─────┼────────┼────────┼─────────────────────
 42  │ 7      │ 999.99 │ 2024-05-30 14:22:01
 ...
10 row(s)
```

Powered by [Claude Code SDK](https://github.com/anthropics/claude-code-sdk-python) — no API key needed, uses your local Claude CLI session.

---

## How It Works

```
User question (CLI or MCP tool call)
        ↓
agents/query_builder.py  ──→  Claude AI (claude-code-sdk)
        ↓  returns SQL
agents/query_executor.py
        ↓
tools/query_tool.py  ──→  3-layer guardrail check
        ↓  if safe
PostgreSQL database
        ↓  results
CLI: main.py prints rich table to terminal
MCP: mcp_server.py returns JSON to the caller
        ↓
context/store.py  ──→  saves question + SQL + outcome to SQLite
```

Every query Claude generates passes through a **three-layer safety guardrail** before it ever touches your database. Only `SELECT` statements execute — no exceptions.

---

## Project Structure

```
pg-query-agent/
├── main.py                        # Interactive CLI — loop, slash commands, rendering
├── mcp_server.py                  # MCP server — exposes 3 tools over stdio
├── agents/
│   ├── query_builder.py           # Natural language → SQL via Claude
│   └── query_executor.py          # SQL → database results via guardrails
├── tools/
│   ├── query_tool.py              # 3-layer guardrail + read-only DB execution
│   └── schema_tool.py             # Reads table structure from PostgreSQL
├── context/
│   └── store.py                   # SQLite memory: schema cache + conversation history
├── config/
│   ├── agents.yaml                # Claude system prompts + agent personas
│   └── tasks.yaml                 # Task descriptions
├── tests/                         # Full test suite (all mocked, no real DB needed)
│   ├── test_agents.py
│   ├── test_context_store.py
│   └── tools/
│       ├── test_guardrail.py
│       ├── test_query_tool.py
│       └── test_schema_tool.py
├── .env.example                   # Copy this to .env and fill in credentials
└── pyproject.toml                 # Dependencies
```

---

## Setup

### Prerequisites

- Python 3.11+
- [uv](https://docs.astral.sh/uv/) (recommended) or pip
- [Claude CLI](https://claude.ai/code) installed and authenticated
- A running PostgreSQL instance

### Install

```bash
cd pg-query-agent

# Create virtual environment and install dependencies
uv sync

# Copy and fill in your database credentials
cp .env.example .env
```

### Configure `.env`

```env
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=mydb
DATABASE_USER=postgres
DATABASE_PASSWORD=secret
```

---

## Usage

### Option 1 — Interactive CLI

```bash
uv run python main.py
```

On startup you'll see a table picker with tab-completion. Select a table and start asking questions.

```
Table: users> how many users signed up this month?
Table: orders> show me failed orders from the last 7 days
Table: products> which products have never been ordered?
```

#### Slash Commands

| Command | Description |
|---|---|
| `/tables` | List all tables in the database |
| `/table <name>` | Switch to a different table |
| `/btw` | Back to table selection (interactive) |
| `/schema` | Re-show the current table's schema |
| `/history` | Show past questions and SQL for this table |
| `/help` | Show all commands |
| `/quit` | Exit |

Tab-complete works for both slash commands and table names.

---

### Option 2 — MCP Server (Kiro / Claude Code)

`mcp_server.py` exposes the same functionality as three callable tools over stdio, so any MCP-compatible AI assistant can query your database directly.

#### Register with Kiro

Add the following to `~/.kiro/settings/mcp.json` under `mcpServers`:

```json
"pg-query-agent": {
  "command": "/path/to/pg-query-agent/.venv/bin/python",
  "args": ["/path/to/pg-query-agent/mcp_server.py"],
  "env": {},
  "autoApprove": ["query", "list_tables", "get_schema"]
}
```

Replace `/path/to/pg-query-agent/` with the absolute path on your machine. Then reconnect MCP servers from the Kiro panel or Command Palette → "Reconnect MCP Servers".

#### Register with Claude Code

Add the following to `~/.claude/settings.json` under `mcpServers`:

```json
"pg-query-agent": {
  "type": "stdio",
  "command": "/path/to/pg-query-agent/.venv/bin/python",
  "args": ["/path/to/pg-query-agent/mcp_server.py"],
  "env": {}
}
```

#### Available MCP Tools

| Tool | Inputs | Returns |
|---|---|---|
| `query` | `table` (string), `question` (string) | `{"sql": "...", "rows": [...], "row_count": N}` |
| `list_tables` | `pattern` (string, optional) | `{"tables": ["orders", "users", ...]}` |
| `get_schema` | `table` (string) | `{"table": "...", "schema": "..."}` |

The `query` tool caches schemas and conversation history in `~/.pg-query-agent/context.db`, so repeated queries on the same table get faster and Claude avoids repeating past SQL mistakes.

On error, `query` returns `{"error": "...", "sql": "..."}` rather than raising — the assistant can surface the message directly.

#### Test the server manually

```bash
# Should start without errors (Ctrl+C to exit)
.venv/bin/python mcp_server.py
```

---

## Architecture Deep Dive

### `mcp_server.py` — MCP Server

Wraps the same agents and tools as the CLI into three MCP tools using `FastMCP` (from the `mcp` package). Runs over stdio — the default transport for Claude Code and Kiro.

Each tool call:
1. Loads `.env` from the project directory (resolved relative to `mcp_server.py`)
2. Validates all 5 required env vars are present
3. Opens a fresh `ContextStore` context manager (no shared state between calls)
4. Delegates to the same `build_query` / `execute_query` / `schema_tool` functions the CLI uses
5. Returns JSON

The `query` tool is `async` (calls `await build_query`). `list_tables` and `get_schema` are sync. FastMCP handles both.

---

### `main.py` — CLI Entry Point

Runs an async interactive loop using `prompt_toolkit` (tab-completion) and `rich` (pretty output).

**Startup sequence:**
1. Validates all 5 required env vars are present
2. Fetches all table names from the `public` schema
3. Shows an interactive table picker
4. Loads the table schema (from SQLite cache if available, otherwise from DB)
5. Enters the main query loop

**Two completers:**
- `SlashCompleter` — activates on `/`, completes command names and table names after `/table `
- `TableCompleter` — used in the table picker, tab-completes table names

---

### `agents/query_builder.py` — Natural Language → SQL

The AI agent. Calls Claude via `claude-code-sdk` (no API key — uses your local Claude CLI session).

1. Loads the system prompt from `config/agents.yaml`
2. Builds a prompt: table name + schema + conversation history + user question
3. Sends it to Claude, streams the response back
4. Extracts SQL from the ` ```sql ... ``` ` code block

**Conversation history injection:** The last 8 interactions are pulled from `ContextStore` and injected into every prompt. If a previous query failed with *"column does not exist"*, Claude sees that and fixes the quoting automatically on the next attempt.

---

### `agents/query_executor.py` — SQL → Results

A thin wrapper around `PostgresReadOnlyQueryTool`. Keeps the agent layer clean while the tool layer handles all safety logic.

---

### `tools/query_tool.py` — The 3-Layer Guardrail

The security core. Every SQL statement passes three independent checks before touching the database:

**Layer 1 — Statement type check (sqlparse)**
Parses the SQL AST and checks `stmt.get_type()`. Anything that isn't `SELECT` is rejected immediately.

**Layer 2 — Keyword token scan**
Scans every token for forbidden keywords: `INSERT`, `UPDATE`, `DELETE`, `DROP`, `CREATE`, `ALTER`, `TRUNCATE`, `GRANT`, `REVOKE`, `EXECUTE`, `CALL`, `MERGE`, `REPLACE`, `UPSERT`. Catches disguised write operations like `SELECT * FROM (INSERT INTO foo VALUES (1)) AS t`.

**Layer 3 — Database-level read-only transaction**
The query runs inside `BEGIN TRANSACTION READ ONLY`. PostgreSQL itself rejects any write attempt at the engine level — the final backstop.

If any layer fails → raises `GuardrailError`. The DB connection is always closed in a `finally` block.

---

### `tools/schema_tool.py` — Schema Inspector

**`list_tables(connection_params, pattern=None)`**
Queries `pg_tables` for all tables in the `public` schema. Supports optional `ILIKE` pattern filtering.

**`get_table_schema(table, connection_params)`**
Queries three PostgreSQL system tables to build a complete picture:
- `information_schema.columns` → column names, types, nullability, defaults
- `pg_indexes` → index definitions
- `pg_constraint` → primary keys, unique constraints, foreign keys

Returns a formatted string that gets fed to Claude as context.

---

### `context/store.py` — SQLite Memory

Persists two things to `~/.pg-query-agent/context.db`:

**Schema cache**
Stores the formatted schema string per table. On startup, if the schema is cached, the DB round-trip is skipped.

**Conversation history**
Every question asked, the SQL generated, and the outcome (row count or error message). Formatted and injected into Claude's prompt so it learns from past mistakes within a session and across sessions.

Supports the context manager protocol — the SQLite connection is always properly closed.

---

### `config/agents.yaml` — Claude's Instructions

Contains the detailed system prompts for both agents.

The `query_builder` prompt enforces:
- Output only a single SQL `SELECT` inside a ` ```sql ``` ` block — no prose
- Double-quote **every** column and table name (critical for camelCase like `createdAt`)
- Always add `LIMIT 50` unless the user asks for more
- Never use `SELECT *` — list columns explicitly
- Never generate write operations
- Correct handling of NULLs, dates, timestamps, booleans, pagination
- Learn from conversation history — never repeat a query that already failed

---

## Tests

All tests are fully mocked — no real database or Claude API needed.

```bash
# Run all tests
uv run pytest

# With coverage
uv run pytest --cov
```

| Test file | What it covers |
|---|---|
| `test_guardrail.py` | All 3 guardrail layers — valid SELECTs pass, all write ops blocked |
| `test_query_tool.py` | Read-only transaction, rollback, connection cleanup |
| `test_schema_tool.py` | Schema formatting, table listing |
| `test_agents.py` | `build_query` (mocked SDK), `execute_query`, `extract_sql` |
| `test_context_store.py` | Schema cache, conversation history, prompt formatting |

---

## Dependencies

| Package | Purpose |
|---|---|
| `claude-code-sdk` | Talks to Claude via local CLI — no API key needed |
| `psycopg2-binary` | PostgreSQL driver |
| `sqlparse` | SQL parsing for the guardrail |
| `rich` | Pretty terminal output (tables, panels, colors) |
| `prompt-toolkit` | Interactive prompt with tab-completion |
| `python-dotenv` | Loads `.env` credentials |
| `pyyaml` | Reads `config/agents.yaml` |
| `mcp` | MCP server framework (`FastMCP`) for the stdio server |

---

## Security Model

This project is designed to be **safe to run against production databases**:

1. **Claude never touches the database directly** — it only generates SQL text
2. **Every query passes the 3-layer guardrail** before execution
3. **All queries run in `BEGIN TRANSACTION READ ONLY`** — PostgreSQL enforces this at the engine level
4. **Credentials stay local** — stored in `.env`, never sent to Claude
5. **Results are read-only** — no writes, no schema changes, no stored procedures

The worst Claude can do is generate a slow `SELECT`. The guardrail and read-only transaction ensure nothing else is possible.
