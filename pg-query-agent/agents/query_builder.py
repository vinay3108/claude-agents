"""query_builder agent: natural language → SQL SELECT via Claude Code SDK."""

import re

import yaml
from claude_code_sdk import ClaudeCodeOptions, query
from claude_code_sdk.types import AssistantMessage, TextBlock

_config: dict = {}


def _load_config() -> dict:
    global _config
    if not _config:
        with open("config/agents.yaml") as f:
            _config = yaml.safe_load(f)
    return _config["query_builder"]


def extract_sql(text: str) -> str:
    """Pull SQL out of a markdown ```sql ... ``` code block."""
    match = re.search(r"```sql\s*(.*?)\s*```", text, re.DOTALL | re.IGNORECASE)
    if match:
        return match.group(1).strip()
    # fallback: return raw text if no code block found
    return text.strip()


async def build_query(
    question: str, schema: str, table: str, history: str = ""
) -> str:
    """
    Convert a natural language question into a SQL SELECT statement.
    Uses Claude via Claude Code SDK — no API key required.

    Args:
        question: Natural language question from the user.
        schema:   Formatted schema string for the target table.
        table:    Table name.
        history:  Optional conversation history from ContextStore — injected
                  into the prompt so Claude can avoid repeating past errors.
    """
    cfg = _load_config()

    history_block = f"\n{history}\n" if history else ""

    prompt = (
        f"Table: {table}\n\n"
        f"Schema:\n{schema}\n"
        f"{history_block}\n"
        f"Question: {question}\n\n"
        "Generate the SQL SELECT query."
    )

    options = ClaudeCodeOptions(
        system_prompt=cfg["system_prompt"],
        allowed_tools=[],  # pure text — no tool access needed
    )

    response_text = ""
    try:
        async for msg in query(prompt=prompt, options=options):
            if isinstance(msg, AssistantMessage):
                for block in msg.content:
                    if isinstance(block, TextBlock):
                        response_text += block.text
    except Exception as e:
        if "Unknown message type" not in str(e):
            raise

    return extract_sql(response_text)
