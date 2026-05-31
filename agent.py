#!/usr/bin/env python3
"""
Simple interactive agent using Claude Code SDK.
No API key needed — uses your Claude subscription via the claude CLI.

Usage:
    .venv/bin/python3 agent.py
    .venv/bin/python3 agent.py --system "You are a Python expert"
    .venv/bin/python3 agent.py --task "Summarize this file" --file readme.txt
"""

import argparse
import asyncio
import sys

from claude_code_sdk import ClaudeCodeOptions, query
from claude_code_sdk.types import AssistantMessage, ResultMessage, TextBlock


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Claude agent (no API key required)")
    p.add_argument("--system", default="You are a helpful assistant. Be concise.", help="System prompt")
    p.add_argument("--task", default=None, help="One-shot task (non-interactive)")
    p.add_argument("--file", default=None, help="Attach file content to --task")
    return p.parse_args()


def extract_text(messages: list) -> str:
    parts = []
    for msg in messages:
        if isinstance(msg, AssistantMessage):
            for block in msg.content:
                if isinstance(block, TextBlock):
                    parts.append(block.text)
    return "".join(parts)


async def run_query(prompt: str, system: str, continue_conversation: bool = False) -> str:
    options = ClaudeCodeOptions(
        system_prompt=system,
        continue_conversation=continue_conversation,
        allowed_tools=[],  # no tools — pure text agent
    )
    messages = []
    try:
        async for msg in query(prompt=prompt, options=options):
            messages.append(msg)
            if isinstance(msg, AssistantMessage):
                for block in msg.content:
                    if isinstance(block, TextBlock):
                        print(block.text, end="", flush=True)
    except Exception as e:
        if "Unknown message type" not in str(e):
            raise
    print()
    return extract_text(messages)


async def run_interactive(system: str) -> None:
    print("Claude Agent  |  type 'quit' to exit  |  no API key needed\n")
    first_turn = True

    while True:
        try:
            user_input = input("You: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nBye!")
            break

        if user_input.lower() in ("quit", "exit", "q", "bye"):
            print("Bye!")
            break

        if not user_input:
            continue

        print("Claude: ", end="", flush=True)
        # continue_conversation=True on subsequent turns keeps context
        await run_query(user_input, system, continue_conversation=not first_turn)
        first_turn = False


async def run_one_shot(task: str, file_path: str | None, system: str) -> None:
    prompt = task
    if file_path:
        try:
            content = open(file_path).read()
            prompt = f"{task}\n\n---\n{content}"
        except OSError as e:
            print(f"Error reading file: {e}", file=sys.stderr)
            sys.exit(1)

    print("Claude: ", end="", flush=True)
    await run_query(prompt, system)


async def main() -> None:
    args = parse_args()

    if args.task:
        await run_one_shot(args.task, args.file, args.system)
    else:
        await run_interactive(args.system)


if __name__ == "__main__":
    asyncio.run(main())
