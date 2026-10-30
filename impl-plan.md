# DocSync-Bot — Implementation Plan

Derived from `architecture.md` (post design-review). Tasks are ordered by dependency; "Blocked by" lists what must
finish first.

## Task List

| # | Task | Package | Blocked by |
|---|------|---------|------------|
| 1 | Scaffold npm-workspaces monorepo: root `package.json`, root `tsconfig.base.json`, `jest.config.js`, 3 workspace packages (`docsync-core`, `docsync-cli`, `docsync-vscode-extension`), `.gitignore`, `.env.example` | repo | — |
| 2 | Define shared types/models: `SymbolModel`, `DriftFinding`, `Suggestion`, `DocAdapter`, `LLMProvider`, `DocSyncConfig` | docsync-core | 1 |
| 3 | Build fixture test data: a small sample TS module + its docstring, a Markdown doc with a linked section, an OpenAPI spec, and a mock Confluence page JSON (base + head versions, with intentional drift) | docsync-core (test fixtures) | 1 |
| 4 | Implement `redactSecrets()` utility + unit tests | docsync-core | 2 |
| 5 | Implement `DiffAnalyzer` (base/head read via `simple-git`, `ts-morph` signature extraction for TS/JS, regex extraction for Python) + unit tests using fixtures | docsync-core | 2, 3 |
| 6 | Implement 4 `DocAdapter`s: Docstring, Markdown, OpenAPI, Confluence (parse/render/locate) + unit tests using fixtures | docsync-core | 2, 3 |
| 7 | Implement config loader (`docsync.config.json` + built-in defaults) and `LinkResolver` (per-type linkage conventions) + unit tests | docsync-core | 2, 6 |
| 8 | Implement `DriftDetector` (concrete rule table from design review) + unit tests | docsync-core | 5, 7 |
| 9 | Implement `LLMProvider` interface + `MockLLMProvider` (deterministic) + `GitHubModelsProvider` (real HTTP call, retry/backoff) + unit tests (mock only; real provider covered by a manual/opt-in integration test) | docsync-core | 2, 4 |
| 10 | Implement `SuggestionEngine` + `Validator` (signature cross-check) + unit tests | docsync-core | 8, 9 |
| 11 | Implement public API entrypoint `checkRepo(options)` wiring 5→7→8→10 together + integration test (end-to-end against fixtures, using `MockLLMProvider`) | docsync-core | 10 |
| 12 | Implement `docsync-cli` (`commander`): `docsync-cli check --base --head` command, Markdown PR-comment formatter, exit-code/check-status logic + unit tests | docsync-cli | 11 |
| 13 | Add GitHub Actions workflow `.github/workflows/docsync.yml` (trigger on `pull_request: [opened, synchronize]`, runs the CLI) | repo | 12 |
| 14 | Implement `docsync-vscode-extension` thin stub: one command (`DocSync: Check Current Branch`), Output channel rendering, minimal webview diff panel | docsync-vscode-extension | 11 |
| 15 | Self code-review (Step 6 checklist) against correctness, security, error handling, test coverage, clarity, DRY, dependency safety | repo | 1–14 |
| 16 | Full verification pass: run entire test suite + lint/build, confirm coverage of happy-path and edge cases ("Not Found"/missing-field) | repo | 15 |
| 17 | Write project `README.md` (setup, config, usage for CLI/Action/extension) | repo | 11–14 |
| 18 | Open PR with required sections (Summary, Changes Made, Test Evidence, Known Limitations, Reviewer Checklist) | repo | 16, 17 |

## Blocked-Task Notes
- Tasks 5, 6 cannot start until fixture data (Task 3) and shared types (Task 2) exist.
- Task 7 is blocked on the Confluence/OpenAPI adapters existing (Task 6) since linkage conventions differ per
  type.
- Task 8 (DriftDetector) needs both the diff output (Task 5) and the resolved doc links (Task 7).
- Task 10 needs both drift findings (Task 8) and a working LLM provider abstraction (Task 9) — these two can be
  built in parallel since they don't depend on each other, then joined at Task 10.
- Tasks 12 and 14 (CLI and extension) both depend only on the Task 11 public API — they can be built in parallel.
- Task 18 (PR) is blocked on verification (16) and documentation (17) being complete.

## Parallelizable Groups
- **Group A** (after Task 2): Task 3 (fixtures) and Task 4 (redactSecrets) — independent.
- **Group B** (after Group A): Task 5 (DiffAnalyzer) and Task 6 (Doc adapters) — independent of each other.
- **Group C** (after Task 6): Task 7 (LinkResolver) and Task 9 (LLMProvider) — independent of each other.
- **Group D** (after Task 11): Task 12 (CLI) and Task 14 (extension) — independent of each other.
