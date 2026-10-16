# SDD ledger — plan: docs/superpowers/plans/2026-10-16-agent-core.md

Pre-flight: Task 1 config is consumed by Tasks 10 and 11; its `AgentConfig` interface matches the plan.
Pre-flight: Task 2 schema is consumed by Tasks 5, 6, 13, 14, and 15; those tasks use the named table exports.
Pre-flight: Task 3 domain interfaces are consumed by Tasks 5 through 16; their names are fixed by the plan.
Ruling: The prescribed SDD workspace path is outside the writable repository. An ignored equivalent ledger is stored under this repository instead; the cost is that an external SDD runner will not discover it.
Task 1: partial — config test and type-check passed; the real Pi smoke run is pending because `.env.local` does not provide `PI_EXTENSION_PATHS`.
Task 2: partial — schema, isolated agent-memory migrations, and a skipped-without-DB integration test exist. Ruling: generator output mixed 23 unrelated unmigrated tables from the dirty worktree with Agent Core tables; replaced it with a seven-table Agent Core-only migration. Database migration is pending because no database environment is configured.
Task 3: complete (tests: npx vitest run src/tests/unit/agent/domain.test.ts && npm run type-check → passed)
Task 4: complete (tests: npx vitest run src/tests/unit/agent/LocalEmbedder.test.ts && npm run type-check → passed; local-model check: 384 0.773 0.509)
Checkpoint: npm test -- --run → 285 passed, 2 skipped; npm run type-check → passed.
Task 5: partial — RRF and both knowledge repositories implemented; database integration verification awaits TEST_DATABASE_URL.
Task 6: partial — run, fact, insight, import repositories and UndoAgentRun implemented; unit test passed. Database integration verification awaits TEST_DATABASE_URL.
Checkpoint: npm run type-check && npm test -- --run → 293 passed, 2 skipped.
