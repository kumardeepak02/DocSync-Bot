# DocSync-Bot — Architecture

## 1. Goals of this Architecture
Deliver a pluggable, testable core engine that:
1. Detects doc-impacting code changes in a diff.
2. Maps changes to documentation artifacts across multiple doc types.
3. Generates AI-assisted update suggestions via a provider-agnostic LLM client.
4. Surfaces suggestions through two front doors: a **VS Code extension** (interactive) and a **CLI** (used by a
   GitHub Action for the automated PR trigger).

The same core engine (`docsync-core`) is shared by both front doors — no logic is duplicated between the
extension and the CI-triggered path.

> **MVP boundary (per Step 3 design review):** `docsync-core`, `docsync-cli`, and the GitHub Action path are
> implemented to full depth with tests across all 4 doc adapters. The VS Code extension is an intentionally thin
> stub — one command that calls `docsync-core` in-process and renders results — rather than a full editor
> integration, to keep implementation/test effort focused on the core engine.

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
                         │                 docsync-core                     │
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
| **DiffAnalyzer** | Uses `simple-git` to get the changed file list for `base...head`, then reads **both** versions of each file (`git show base:path`, `git show head:path`) and parses each independently with the matching language adapter (`ts-morph` for TS/JS, regex-based signature extraction for Python) into a `SymbolModel`. Diffs the base/head `SymbolModel` lists to produce `changedSymbols` (added/removed/modified). |
| **LinkResolver** | Loads `docsync.config.json` (or built-in defaults if absent), resolves which doc artifacts are linked to each changed symbol using the per-doc-type linkage convention (§3.2). |
| **DriftDetector** | Applies the concrete drift rules (§3.1) to each changed symbol + its linked doc artifact (if any); outputs `DriftFinding[]` with a severity (`high`/`medium`/`low`). |
| **SuggestionEngine** | For each `DriftFinding`, redacts likely secrets from the code/diff snippet (`redactSecrets()`), renders a doc-type-specific prompt template, and calls `LLMProvider.generate()`. Falls back to detection-only (no generated content) if no `LLMProvider` is configured. |
| **Validator** | Static cross-check: every parameter/type named in the generated text must exist in the actual signature; strips/flags unverifiable claims before returning a suggestion. |
| **Doc-Type Adapters** | Each adapter implements a common `DocAdapter` interface: `parse(file) → DocModel`, `render(DocModel) → string`, `locate(symbol) → DocModel \| undefined`. One adapter per doc type (docstring, Markdown, OpenAPI, Confluence). |
| **Output Sinks** | Deliver the final `Suggestion[]` to the right surface: GitHub PR check + comment (CLI/Action path), VS Code Output channel + diff webview (extension path), or direct Confluence publish (opt-in, explicit accept only). |
| **LLMProvider** | Interface with two implementations: `MockLLMProvider` (deterministic, offline, used in tests) and `GitHubModelsProvider` (real calls to the GitHub Models/Copilot inference endpoint). Resolved to `undefined` (→ fallback mode) when no API key env var is set. |

### 3.1 Concrete Drift Rules (resolved in Design Review, Finding 3)

| Condition | Severity |
|---|---|
| Documented parameter names/count/order differ from code | `high` |
| Documented parameter or return type differs from code | `high` |
| New exported symbol added with no linked doc artifact | `medium` |
| Signature unchanged, but function body changed >30% of lines | `low` (flagged for review, not asserted wrong) |

### 3.2 Doc-to-Code Linkage Convention per Type (resolved in Design Review, Finding 4)

| Doc type | Linkage mechanism |
|---|---|
| Docstring | Symbol identity is structural (same file + function/class name) — no tag needed. |
| Markdown | Inline `<!-- docsync:ref <symbolId> -->` comment above the documented section. |
| OpenAPI | `x-docsync-ref: <symbolId>` vendor extension on the operation object. |
| Confluence | Explicit entries in `docsync.config.json`: `{"symbolId": "...", "confluencePageId": "..."}` (pages can't carry inline code tags). |

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
| VS Code extension | `vscode` Extension API, `docsync-core` as a dependency | Keeps UI thin; all logic lives in the testable core package. |
| Testing | `jest` + `ts-jest` | Standard TS testing stack, good mocking support for `LLMProvider`. |
| CI trigger | GitHub Actions workflow (`.github/workflows/docsync.yml`) on `pull_request` (opened/synchronize) | Matches FR-13; runs `docsync-cli check`. |

## 5. Data Flow (PR-Triggered Path)

1. GitHub Action fires on `pull_request: [opened, synchronize]`.
2. Workflow checks out the PR's merge commit (`actions/checkout` with `fetch-depth: 0`) and runs
   `npx docsync-cli check --base origin/<base> --head HEAD`.
3. `DiffAnalyzer` reads base + head versions of each changed file → `changedSymbols`. `LinkResolver` maps them to
   doc artifacts → `DriftDetector` applies the drift rules (§3.1) to emit `DriftFinding[]`.
4. For each finding, `SuggestionEngine` redacts secrets, calls the configured `LLMProvider` (or falls back to
   detection-only if none is configured) → `Validator` checks the result → emits `Suggestion[]`.
5. CLI formats `Suggestion[]` as a PR comment (Markdown table + diff blocks) and sets a check-run status
   (`neutral` if no findings or fallback mode; `success`/`failure` otherwise, per `docsync.config.json` severity
   threshold — FR-18).
6. CLI exit code reflects pass/fail for the GitHub Actions job status.

## 6. Data Flow (VS Code Manual Path)

1. User runs **"DocSync: Check Current Branch"** from the command palette.
2. Extension calls the same `docsync-core` API in-process (no CLI spawn needed) with `base = default branch`,
   `head = working tree`.
3. Results render in the Output channel and a simple webview diff panel; each suggestion has **Accept / Edit /
   Reject** actions (FR-16).
4. On **Accept**, the extension writes the change directly to the file in the editor (undo-able), leaving the
   commit to the user's normal git workflow.

## 7. Key Design Decisions
- **Single shared core, two thin front doors** — avoids divergent detection logic between CI and the editor.
- **Suggestions are never auto-applied** — both paths always produce a diff requiring explicit human acceptance
  (NFR-5).
- **LLMProvider is swappable** — `MockLLMProvider` used in all unit/integration tests so the suite is
  deterministic and runs with zero cost/network dependency; `GitHubModelsProvider` used for real/manual runs via
  an API key read from an environment variable (never committed — NFR-8), with automatic fallback to
  detection-only mode when the variable is absent (NFR-4).
- **Outbound secret redaction** — `redactSecrets()` strips common API-key/token/connection-string shapes from any
  code/diff snippet before it is included in an LLM prompt (defense-in-depth alongside path exclusion — NFR-7,
  NFR-10).
- **Confluence publish is opt-in only** — the adapter can generate a suggested page diff, but actually calling the
  Confluence write API requires an explicit `--publish` flag/UI action, never implicit.
- **Config defaults** — absence of `docsync.config.json` is not an error: the CLI/extension falls back to
  built-in defaults (whole-repo scan, all 4 adapters enabled, `medium` severity blocks merge) and logs that
  defaults are in effect.

## 8. Known Limitations (MVP)
- Python signature extraction uses regex-based parsing (not full AST) — acceptable for MVP; Java/Go are
  documented as future adapters, not implemented.
- Confluence integration is tested against a mocked HTTP layer, not a live Confluence instance.
- GitHub Models/Copilot endpoint rate limits are unknown at build time; `SuggestionEngine` includes basic
  retry/backoff but no adaptive throttling.
- VS Code extension is a thin command + webview, not a full inline-editor integration (see MVP boundary, §1).
