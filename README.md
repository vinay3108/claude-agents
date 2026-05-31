# claude-agents

A collection of AI agents built with the [Claude Code SDK](https://github.com/anthropics/claude-code-sdk-python).

No API key needed — every agent runs through your local Claude CLI session using your existing Claude subscription.

---

## Philosophy

Each agent in this repo follows the same core pattern:

- **Claude handles reasoning** — natural language understanding, code generation, decision making
- **Tools handle execution** — database queries, file I/O, API calls, shell commands
- **Guardrails handle safety** — validation layers that sit between Claude's output and the real world
- **Context stores handle memory** — SQLite or similar persistence so agents learn from past interactions

Agents are self-contained in their own folders with their own dependencies, config, and tests. You can run any one of them independently.

---

## Agents

### [`pg-query-agent`](./pg-query-agent)

Natural language → PostgreSQL queries via an interactive CLI.

Ask questions in plain English, get results from your database. A three-layer guardrail system ensures only `SELECT` statements ever execute — safe to point at production.

```
Table: orders> show me failed orders from the last 7 days
SQL → SELECT "id", "userId", "status", "createdAt" FROM "orders"
      WHERE "status" = 'failed' AND "createdAt" >= NOW() - INTERVAL '7 days'
      LIMIT 50
```

**Key features:**
- Tab-completion for table names and slash commands
- Schema inspection with SQLite caching
- Conversation history injected into prompts so Claude learns from past errors
- Three-layer read-only guardrail (sqlparse → keyword scan → `BEGIN TRANSACTION READ ONLY`)

→ [Full documentation](./pg-query-agent/README.md)

---

<!-- Add new agents above this line, following the same format -->

## Shared Utilities

### `agent.py`

A minimal interactive agent at the repo root — useful as a starting point or for quick one-off tasks.

```bash
# Interactive chat
python agent.py

# Custom system prompt
python agent.py --system "You are a Python expert"

# One-shot task with a file
python agent.py --task "Summarize this file" --file notes.txt
```

Supports multi-turn conversation (`continue_conversation=True` on subsequent turns keeps context across messages).

---

## Getting Started

### Prerequisites

- Python 3.11+
- [uv](https://docs.astral.sh/uv/) (recommended) or pip
- [Claude CLI](https://claude.ai/code) installed and authenticated

```bash
# Install Claude CLI (if not already installed)
# Follow: https://claude.ai/code
```

### Running an Agent

Each agent is self-contained. Navigate into its folder and follow its own README:

```bash
cd pg-query-agent
uv sync
cp .env.example .env   # fill in your credentials
uv run python main.py
```

---

## Adding a New Agent

1. Create a new folder at the repo root: `my-new-agent/`
2. Follow this structure:

```
my-new-agent/
├── main.py              # Entry point
├── agents/              # Agent logic (Claude interactions)
├── tools/               # Tool implementations (execution layer)
├── context/             # State / memory persistence
├── config/
│   └── agents.yaml      # System prompts and agent personas
├── tests/               # Mocked unit tests
├── pyproject.toml       # Dependencies
├── .env.example         # Required environment variables
└── README.md            # Agent-specific documentation
```

3. Add an entry for it in the [Agents](#agents) section above.

### Design Principles to Follow

**Separate concerns clearly:**
- `agents/` — only Claude interactions, prompt building, response parsing
- `tools/` — only execution logic (DB, API, filesystem), no Claude calls
- `context/` — only persistence and state management

**Always add guardrails between Claude and execution:**
Claude's output is text — validate it before acting on it. The `pg-query-agent` guardrail pattern (parse → keyword scan → engine-level enforcement) is a good template.

**Mock everything in tests:**
No real external services in tests. Mock the Claude SDK, database drivers, and API clients. Tests should run offline with no credentials.

**Inject context into prompts:**
Store conversation history and feed it back into subsequent prompts. This lets Claude self-correct without the user having to repeat themselves.

---

## Tech Stack

| Package | Purpose |
|---|---|
| `claude-code-sdk` | Claude integration — no API key, uses local CLI |
| `psycopg2-binary` | PostgreSQL driver (pg-query-agent) |
| `sqlparse` | SQL parsing for guardrails |
| `rich` | Terminal output formatting |
| `prompt-toolkit` | Interactive prompts with tab-completion |
| `python-dotenv` | Environment variable loading |
| `pyyaml` | Agent config files |
| `pytest` + `pytest-asyncio` | Testing |

---

## Project Structure

```
claude-agents/
├── README.md              ← You are here
├── agent.py               ← Minimal standalone agent (starting point)
├── pg-query-agent/        ← Natural language PostgreSQL queries
│   └── README.md
└── <future-agents>/       ← Add new agents here
```
