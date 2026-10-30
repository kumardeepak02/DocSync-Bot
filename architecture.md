# DocSync-Bot — Architecture

## 1. Goals of this Architecture
Deliver a pluggable, testable core engine that:
1. Detects doc-impacting code changes in a diff.
2. Maps changes to documentation artifacts across multiple doc types.
3. Generates AI-assisted update suggestions via a provider-agnostic LLM client.
4. Surfaces suggestions through two front doors: a **VS Code extension** (interactive) and a **CLI** (used by a
   GitHub Action for the automated PR trigger).

The same core engine (`@docsync/core`) is shared by both front doors — no logic is duplicated between the
extension and the CI-triggered path.

## 2. High-Level Component Diagram

```
                         ┌────────────────────────────────────────────┐
                         │                 Triggers                    │
                         │  ┌──────────────┐      ┌──────────────────┐│
                         │  │ GitHub Action │      │ VS Code command  ││
                         │  │ (PR open/sync)│      │ (manual, on-demand)││
                         │  └──────┬───────┘      └─────────┬────────┘│
                         └─────────┼─────────────────────────┼─────────┘
                                   │                          │
                                   ▼                          ▼
                         ┌─────────────────────────────────────────────┐
                         │              docsync-cli (bin)               │
                         │     (thin wrapper: parses args/env, calls     │
                         │        core, formats output / exit code)     │
                         └───────────────────────┬───────────────────────┘
                                                  │
                         ┌────────────────────────▼────────────────────────┐
                         │                 @docsync/core                    │
                         │                                                   │
                         │  ┌───────────────┐   ┌─────────────────────────┐ │
                         │  │ DiffAnalyzer  │──▶│ LinkResolver             │ │
                         │  │ (git diff →   │   │ (code symbol ⇄ doc       │ │
                         │  │  changed      │   │  artifact mapping via    │ │
                         │  │  symbols)     │   │  docsync.config.json)    │ │
                         │  └───────────────┘   └───────────┬─────────────┘ │
                         │                                   │               │
                         │                                   ▼               │
                         │                     ┌─────────────────────────┐   │
                         │                     │ DriftDetector            │   │
                         │                     │ (semantic diff: code vs  │   │
                         │                     │  doc content)            │   │
                         │                     └───────────┬─────────────┘   │
                         │                                   │                │
                         │                                   ▼                │
                         │                     ┌─────────────────────────┐    │
                         │                     │ SuggestionEngine         │    │
                         │                     │ (prompt templates +      │    │
                         │                     │  LLMProvider interface)  │    │
                         │                     └───────────┬─────────────┘    │
                         │                                   │                 │
                         │                                   ▼                 │
                         │                     ┌─────────────────────────┐     │
                         │                     │ Validator                │     │
                         │                     │ (cross-check generated   │     │
                         │                     │  text vs. real signatures)│     │
                         │                     └───────────┬─────────────┘     │
                         │                                   │                  │
                         └───────────────────────────────────┼──────────────────┘
                                                              ▼
                         ┌─────────────────────────────────────────────────────┐
                         │                 Doc-Type Adapters (pluggable)         │
                         │  ┌───────────┐ ┌───────────┐ ┌─────────┐ ┌─────────┐ │
                         │  │ Docstring │ │ Markdown  │ │ OpenAPI │ │ Confluence│ │
                         │  │ Adapter   │ │ Adapter   │ │ Adapter │ │ Adapter   │ │
                         │  └───────────┘ └───────────┘ └─────────┘ └─────────┘ │
                         └─────────────────────────────────────────────────────┘
                                                              │
                         ┌────────────────────────────────────▼────────────────┐
                         │              Output Sinks (pluggable)                 │
                         │  ┌───────────────┐ ┌───────────────┐ ┌──────────────┐│
                         │  │ GitHub PR     │ │ VS Code Diff  │ │ Confluence   ││
                         │  │ comment/check │ │ view (webview)│ │ REST publish ││
                         │  └───────────────┘ └───────────────┘ └──────────────┘│
                         └───────────────────────────────────────────────────────┘
```

## 3. Component Responsibilities

| Component | Responsibility |
|---|---|
| **DiffAnalyzer** | Parses a git diff (base...head) using `simple-git` + language parsers (`ts-morph` for TS/JS, regex/AST stubs for Python) to extract changed exported symbols: functions, classes, params, return types. |
| **LinkResolver** | Loads `docsync.config.json`, resolves which doc artifacts are linked to each changed symbol (via `@docsync:ref` tags, naming convention, or explicit map). |
| **DriftDetector** | Compares the linked doc's extracted structure (params, types, described behavior) against the new code structure; outputs a list of `DriftFinding` objects with a severity. |
| **SuggestionEngine** | For each `DriftFinding`, renders a doc-type-specific prompt template and calls `LLMProvider.generate()` to produce proposed new doc content. |
| **Validator** | Static cross-check: every parameter/type named in the generated text must exist in the actual signature; strips/flags unverifiable claims before returning a suggestion. |
| **Doc-Type Adapters** | Each adapter implements a common `DocAdapter` interface: `parse(file) → DocModel`, `render(DocModel) → string`, `locate(symbol) → DocModel \| undefined`. One adapter per doc type (docstring, Markdown, OpenAPI, Confluence). |
| **Output Sinks** | Deliver the final `Suggestion[]` to the right surface: GitHub PR check + comment (CLI/Action path), VS Code diff webview (extension path), or direct Confluence publish (opt-in, explicit accept only). |
| **LLMProvider** | Interface with two implementations: `MockLLMProvider` (deterministic, offline, used in tests) and `GitHubModelsProvider` (real calls to the GitHub Models/Copilot inference endpoint). |

## 4. Technology Choices

| Concern | Choice | Rationale |
|---|---|---|
| Language/runtime | TypeScript on Node.js 20+ | Matches VS Code extension API; one language across core/CLI/extension. |
| Monorepo tooling | npm workspaces | Simple, no extra tooling needed for 3 packages. |
| Git diff parsing | `simple-git` | Mature wrapper over the `git` CLI already present in CI/dev environments. |
| TS/JS code parsing | `ts-morph` | Reliable AST access to function signatures and JSDoc blocks. |
| Markdown parsing | `remark`/`unified` | Standard, extensible Markdown AST tooling. |
| OpenAPI parsing | `@apidevtools/swagger-parser` / `yaml` | De-facto standard for OpenAPI load/validate. |
| Confluence integration | Confluence REST API v2 via `fetch` | No heavy SDK dependency; REST is stable and documented. |
| LLM transport | GitHub Models inference endpoint (OpenAI-compatible chat completion) via `fetch` | Matches the API key the user already holds; OpenAI-compatible shape keeps `LLMProvider` portable to other vendors later. |
| CLI | `commander` | Lightweight, standard Node CLI argument parsing. |
| VS Code extension | `vscode` Extension API, `@docsync/core` as a dependency | Keeps UI thin; all logic lives in the testable core package. |
| Testing | `jest` + `ts-jest` | Standard TS testing stack, good mocking support for `LLMProvider`. |
| CI trigger | GitHub Actions workflow (`.github/workflows/docsync.yml`) on `pull_request` (opened/synchronize) | Matches FR-13; runs `docsync-cli check`. |

## 5. Data Flow (PR-Triggered Path)

1. GitHub Action fires on `pull_request: [opened, synchronize]`.
2. Workflow checks out the PR's merge commit (`actions/checkout` with `fetch-depth: 0`) and runs
   `npx docsync-cli check --base origin/<base> --head HEAD`.
3. `DiffAnalyzer` computes changed symbols → `LinkResolver` maps them to doc artifacts → `DriftDetector` emits
   `DriftFinding[]`.
4. For each finding, `SuggestionEngine` calls the configured `LLMProvider` → `Validator` checks the result →
   emits `Suggestion[]`.
5. CLI formats `Suggestion[]` as a PR comment (Markdown table + diff blocks) and sets a check-run status
   (`neutral`/`success`/`failure` depending on `docsync.config.json` severity threshold — FR-18).
6. CLI exit code reflects pass/fail for the GitHub Actions job status.

## 6. Data Flow (VS Code Manual Path)

1. User runs **"DocSync: Check Current Branch"** from the command palette.
2. Extension calls the same `@docsync/core` API in-process (no CLI spawn needed) with `base = default branch`,
   `head = working tree`.
3. Results render in a webview diff panel; each suggestion has **Accept / Edit / Reject** actions (FR-16).
4. On **Accept**, the extension writes the change directly to the file in the editor (undo-able), leaving the
   commit to the user's normal git workflow.

## 7. Key Design Decisions
- **Single shared core, two thin front doors** — avoids divergent detection logic between CI and the editor.
- **Suggestions are never auto-applied** — both paths always produce a diff requiring explicit human acceptance
  (NFR-5).
- **LLMProvider is swappable** — `MockLLMProvider` used in all unit/integration tests so the suite is
  deterministic and runs with zero cost/network dependency; `GitHubModelsProvider` used for real/manual runs via
  an API key read from an environment variable (never committed — NFR-8).
- **Confluence publish is opt-in only** — the adapter can generate a suggested page diff, but actually calling the
  Confluence write API requires an explicit `--publish` flag/UI action, never implicit.

## 8. Risks / Open Questions (feeds into Step 3 Design Review)
- Python/Java/Go AST parsing is stubbed at MVP depth (regex-based signature extraction) rather than full AST —
  acceptable for MVP, flagged as a known limitation.
- Confluence API requires a real space/page under a real Confluence instance to fully integration-test; MVP tests
  will mock the Confluence HTTP layer.
- GitHub Models/Copilot endpoint rate limits are unknown at build time; `SuggestionEngine` needs basic
  retry/backoff.
