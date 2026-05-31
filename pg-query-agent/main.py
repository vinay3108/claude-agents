#!/usr/bin/env python3
"""pg-query-agent: natural language → PostgreSQL via Claude Code SDK."""

import asyncio
import os
import re
import sys
from dataclasses import dataclass

from dotenv import load_dotenv
from prompt_toolkit import PromptSession
from prompt_toolkit.completion import Completer, Completion
from prompt_toolkit.styles import Style
from rich.console import Console
from rich.panel import Panel
from rich.table import Table as RichTable

from agents.query_builder import build_query
from agents.query_executor import execute_query
from context.store import ContextStore
from tools.query_tool import GuardrailError
from tools.schema_tool import get_table_schema, list_tables

load_dotenv()

console = Console()

REQUIRED_ENV = [
    "DATABASE_HOST",
    "DATABASE_PORT",
    "DATABASE_NAME",
    "DATABASE_USER",
    "DATABASE_PASSWORD",
]

HELP_TEXT = """\
[bold]Slash commands:[/bold]
  [cyan]/tables[/cyan]          list all tables in the database
  [cyan]/table <name>[/cyan]    switch to a different table
  [cyan]/btw[/cyan]             back to table selection (interactive)
  [cyan]/schema[/cyan]          re-show current table schema
  [cyan]/history[/cyan]         show query history for current table
  [cyan]/help[/cyan]            show this help
  [cyan]/quit[/cyan]            exit

Anything else is treated as a natural language question."""

# ── slash commands metadata (used by completer + handler) ────────────────────

_SLASH_COMMANDS: list[tuple[str, str]] = [
    ("/tables",  "list all tables in the database"),
    ("/table",   "switch to a table — /table <name>"),
    ("/btw",     "back to table selection"),
    ("/schema",  "show current table schema"),
    ("/history", "show query history for this table"),
    ("/help",    "show all commands"),
    ("/quit",    "exit"),
]

_PROMPT_STYLE = Style.from_dict({
    "completion-menu.completion":         "bg:#1e1e2e fg:#cdd6f4",
    "completion-menu.completion.current": "bg:#313244 fg:#cba6f7 bold",
    "completion-menu.meta.completion":              "fg:#585b70",
    "completion-menu.meta.completion.current":      "fg:#a6adc8",
})


# ── completers ────────────────────────────────────────────────────────────────

class SlashCompleter(Completer):
    """
    Activates only when input starts with '/'.
    - '/'      or '/par...'  → complete command names
    - '/table ' + partial    → complete table names
    """

    def __init__(self, tables: list[str]) -> None:
        self._tables = tables

    def get_completions(self, document, _complete_event):
        text = document.text_before_cursor
        if not text.startswith("/"):
            return

        # /table <partial_table_name>
        m = re.match(r"^/table\s+", text)
        if m:
            partial = text[m.end():]
            for t in self._tables:
                if t.lower().startswith(partial.lower()):
                    yield Completion(t, start_position=-len(partial), display_meta="table")
            return

        # / or /partial — complete command
        for cmd, meta in _SLASH_COMMANDS:
            if cmd.startswith(text):
                yield Completion(
                    cmd,
                    start_position=-len(text),
                    display=cmd,
                    display_meta=meta,
                )


class TableCompleter(Completer):
    """Simple completer for bare table-name input (used in the table picker)."""

    def __init__(self, tables: list[str]) -> None:
        self._tables = tables

    def get_completions(self, document, _complete_event):
        partial = document.text_before_cursor
        for t in self._tables:
            if t.lower().startswith(partial.lower()):
                yield Completion(t, start_position=-len(partial))


# ── helpers ───────────────────────────────────────────────────────────────────

def _get_connection_params() -> dict:
    return {
        "host": os.environ["DATABASE_HOST"],
        "port": int(os.environ.get("DATABASE_PORT", "5432")),
        "dbname": os.environ["DATABASE_NAME"],
        "user": os.environ["DATABASE_USER"],
        "password": os.environ["DATABASE_PASSWORD"],
    }


def _validate_env() -> None:
    missing = [v for v in REQUIRED_ENV if not os.environ.get(v)]
    if missing:
        console.print(f"[red]Missing environment variables: {', '.join(missing)}[/red]")
        console.print("Copy [bold].env.example[/bold] → [bold].env[/bold] and fill in your credentials.")
        sys.exit(1)


def _show_tables(tables: list[str], current: str) -> None:
    console.print("\n[bold]Tables:[/bold]")
    for t in tables:
        marker = "[bold cyan]* [/bold cyan]" if t == current else "  "
        console.print(f"{marker}{t}")
    console.print()


def _load_table(table_name: str, conn: dict, store: ContextStore) -> tuple[str, str]:
    schema = store.get_schema(table_name)
    if schema:
        console.print("[dim]Schema loaded from context cache.[/dim]")
    else:
        schema = get_table_schema(table_name, conn)
        store.save_schema(table_name, schema)
    return table_name, schema


def _display_results(rows: list[dict]) -> None:
    if not rows:
        console.print("[yellow]No rows returned.[/yellow]")
        return

    tbl = RichTable(show_header=True, header_style="bold cyan", border_style="dim")
    for col in rows[0]:
        tbl.add_column(str(col))
    for row in rows:
        tbl.add_row(*[str(v) if v is not None else "NULL" for v in row.values()])

    console.print(tbl)
    console.print(f"[dim]{len(rows)} row(s)[/dim]")


def _parse_slash(text: str) -> tuple[str, str] | None:
    if not text.startswith("/"):
        return None
    parts = text[1:].split(maxsplit=1)
    return parts[0].lower(), (parts[1] if len(parts) > 1 else "")


async def _interactive_table_select(
    tables: list[str], conn: dict, store: ContextStore
) -> tuple[str, str] | None:
    """Prompt user to pick a table (with tab-completion). Returns (name, schema) or None."""
    _show_tables(tables, current="")
    picker = PromptSession(
        completer=TableCompleter(tables),
        style=_PROMPT_STYLE,
        complete_while_typing=True,
    )
    while True:
        try:
            name = (await picker.prompt_async("Table: ")).strip()
        except (EOFError, KeyboardInterrupt):
            return None
        if name.lower() in ("quit", "exit", "/quit"):
            return None
        if name in tables:
            t, s = _load_table(name, conn, store)
            console.print(Panel(s, title=f"[bold]{t}[/bold]", border_style="dim"))
            return t, s
        console.print(f"[red]'{name}' not found. Tab-complete or type /quit to exit.[/red]")


# ── slash command handler ─────────────────────────────────────────────────────

@dataclass
class _State:
    table_name: str
    schema: str
    should_exit: bool = False
    switch_table: bool = False


async def _handle_slash(
    cmd: str, args: str, state: _State, tables: list[str], conn: dict, store: ContextStore
) -> bool:
    """Returns True to keep the query loop running, False to break out."""
    if cmd in ("quit", "q", "exit"):
        state.should_exit = True
        console.print("[dim]bye[/dim]")
        return False

    if cmd == "tables":
        _show_tables(tables, current=state.table_name)
        return True

    if cmd == "table":
        if not args:
            console.print("[yellow]Usage: /table <name>[/yellow]")
            return True
        if args not in tables:
            console.print(f"[red]Table '{args}' not found. Use /tables to list.[/red]")
            return True
        state.table_name, state.schema = _load_table(args, conn, store)
        console.print(Panel(state.schema, title=f"[bold]{state.table_name}[/bold]", border_style="dim"))
        return True

    if cmd == "btw":
        state.switch_table = True
        return False

    if cmd == "schema":
        console.print(Panel(state.schema, title=f"[bold]{state.table_name}[/bold]", border_style="dim"))
        return True

    if cmd == "history":
        history = store.format_history_for_prompt(state.table_name)
        if history:
            console.print(Panel(history, title=f"[bold]History: {state.table_name}[/bold]", border_style="dim"))
        else:
            console.print("[yellow]No history yet for this table.[/yellow]")
        return True

    if cmd == "help":
        console.print(Panel(HELP_TEXT, title="[bold]Help[/bold]", border_style="dim"))
        return True

    console.print(f"[red]Unknown command: /{cmd}[/red]  — type [cyan]/help[/cyan] for commands.")
    return True


# ── main ──────────────────────────────────────────────────────────────────────

async def main() -> None:
    _validate_env()
    conn = _get_connection_params()

    console.print(
        Panel(
            "[bold cyan]pg-query-agent[/bold cyan]  —  natural language → PostgreSQL\n"
            "[dim]Powered by Claude Code SDK  ·  no API key needed  ·  type [bold]/help[/bold] for commands[/dim]",
            expand=False,
        )
    )

    tables = list_tables(conn)
    if not tables:
        console.print("[red]No tables found in public schema.[/red]")
        sys.exit(1)

    with ContextStore() as store:
        result = await _interactive_table_select(tables, conn, store)
        if result is None:
            return

        state = _State(table_name=result[0], schema=result[1])

        # one session shared across the query loop — persists history between turns
        session: PromptSession = PromptSession(
            completer=SlashCompleter(tables),
            style=_PROMPT_STYLE,
            complete_while_typing=True,
        )

        while not state.should_exit:
            state.switch_table = False
            console.print(
                f"\n[dim]Table: [bold]{state.table_name}[/bold]  ·  ask a question or type [cyan]/help[/cyan][/dim]\n"
            )

            # ── query loop ────────────────────────────────────────────────────
            while not state.should_exit and not state.switch_table:
                try:
                    user_input = (
                        await session.prompt_async(f"{state.table_name}> ")
                    ).strip()
                except (EOFError, KeyboardInterrupt):
                    console.print("\n[dim]bye[/dim]")
                    state.should_exit = True
                    break

                if not user_input:
                    continue

                parsed = _parse_slash(user_input)
                if parsed:
                    cmd, args = parsed
                    keep_going = await _handle_slash(cmd, args, state, tables, conn, store)
                    if not keep_going:
                        break
                    continue

                # natural language → SQL
                history = store.format_history_for_prompt(state.table_name)
                with console.status("[cyan]building query…[/cyan]"):
                    sql = await build_query(user_input, state.schema, state.table_name, history=history)

                console.print(f"\n[dim]SQL →[/dim] [cyan]{sql}[/cyan]\n")

                try:
                    with console.status("[cyan]executing…[/cyan]"):
                        rows = execute_query(sql, conn)
                    store.save_query(state.table_name, user_input, sql, row_count=len(rows))
                    _display_results(rows)
                except GuardrailError as e:
                    err = str(e)
                    store.save_query(state.table_name, user_input, sql, error=f"Guardrail: {err}")
                    console.print(f"[red bold]Guardrail blocked:[/red bold] {err}")
                except Exception as e:
                    err = str(e).split("\n")[0]
                    store.save_query(state.table_name, user_input, sql, error=err)
                    console.print(f"[red]Error:[/red] {err}")

                console.print()

            # ── back to table selection ───────────────────────────────────────
            if state.switch_table and not state.should_exit:
                result = await _interactive_table_select(tables, conn, store)
                if result is None:
                    break
                state.table_name, state.schema = result


if __name__ == "__main__":
    asyncio.run(main())
