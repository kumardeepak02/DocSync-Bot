# DocSync-Bot — Design Review

Reviewer role: senior engineer reviewing `architecture.md` before implementation begins.

## 1. Risks & Gaps Identified

| # | Area | Finding | Severity |
|---|------|---------|----------|
| 1 | Scope | Four doc adapters + VS Code extension + CLI + GitHub Action + Confluence publish is too much to implement *deeply* in one capstone pass. Risk: shallow, untested code everywhere instead of a solid, well-tested core. | High |
| 2 | Diff correctness | `DiffAnalyzer` as drafted only parses the **current** (head) version of a file. Without the **base** version's AST, there's nothing to diff signatures against — drift detection would have no "before" state. | High |
| 3 | Drift algorithm | "`DriftDetector` emits `DriftFinding[]`" was described only at a conceptual level — no concrete rule set for what counts as drift. Ambiguous specs can't be reliably tested. | High |
| 4 | Doc-to-code linkage | Linkage convention (`@docsync:ref`) was mentioned but not specified per doc type. OpenAPI and Confluence can't embed code comments the way docstrings/Markdown can. | Medium |
| 5 | LLM availability | No concrete behavior defined for "no API key configured" in the GitHub Action path — would make the Action always fail/error rather than degrading gracefully per NFR-4. | Medium |
| 6 | Secret safety | Validator checks generated output against signatures, but nothing screens the **outbound prompt** (code/diff content) for accidental secrets before it's sent to the LLM — a gap against NFR-7/NFR-10. | Medium |
| 7 | Package naming | `@docsync/core` implies a published npm scope/org that doesn't exist. Could confuse contributors into thinking it's a published package. | Low |
| 8 | Config robustness | No defined behavior when `docsync.config.json` is missing or malformed — first run would crash instead of using sensible defaults. | Low |
| 9 | Confluence testability | Confirmed already mitigated in architecture (mock HTTP layer) — no action needed, noting as resolved. | — |

## 2. Agreed Design Decisions (Resolutions)

1. **Scope (Finding 1)** — Reduce breadth, increase depth:
   - Implement **core engine + CLI + GitHub Action path fully**, with real tests, for all 4 doc adapters at a
     consistent but intentionally-scoped depth (TS/JS + Python signature extraction; Markdown; OpenAPI;
     Confluence via mocked HTTP).
   - The **VS Code extension is a thin, working stub**: one command (`DocSync: Check Current Branch`) that calls
     `docsync-core` in-process and renders results in the Output channel + a simple webview diff — not a
     full-featured editor integration. This keeps the capstone's "IDE extension" requirement satisfied without
     overcommitting review/test time to editor UI.
   - Documented explicitly as the MVP boundary in `impl-plan.md`.

2. **Base-vs-head diffing (Finding 2)** — `DiffAnalyzer` uses `git show <base>:<path>` and `git show <head>:<path>`
   (via `simple-git`) to get both file versions, parses each independently with the same language adapter, and
   diffs the two `SymbolModel` lists (added/removed/changed params, return type, name).

3. **Concrete drift rules (Finding 3)** — For MVP, a `DriftFinding` is raised when, for a symbol with a linked doc
   artifact:
   - Parameter **names**, **count**, or **order** differ between code and documented signature → `high` severity.
   - Parameter or return **type** annotation differs → `high` severity.
   - Symbol is **newly added** and has no linked doc artifact at all → `medium` severity ("undocumented new
     symbol").
   - Symbol/doc both exist and signatures match, but the code body changed non-trivially (heuristic: >30% line
     delta) → `low` severity ("behavior may have changed; description not re-verified") — flagged for human/AI
     review rather than auto-asserted as wrong.
   This gives deterministic, unit-testable rules rather than vague "semantic diff".

4. **Doc-linkage per type (Finding 4)**:
   - Docstrings/Markdown: inline `@docsync:ref <symbolId>` tag (comment or HTML comment).
   - OpenAPI: `x-docsync-ref: <symbolId>` vendor extension on the operation object.
   - Confluence: explicit mapping entries in `docsync.config.json` (`{"symbolId": "...", "confluencePageId": "..."}`)
     since wiki pages can't carry inline code-comment tags.

5. **Graceful LLM fallback (Finding 5)** — If no LLM API key is present in the environment, `SuggestionEngine`
   automatically falls back to **detection-only mode**: it still reports `DriftFinding`s (no AI-generated content)
   and the CLI/Action exits with a `neutral` check status plus a clear message, rather than failing the job.

6. **Secret redaction before prompting (Finding 6)** — Add a `redactSecrets()` pass (regex-based: common API key/
   token/connection-string shapes) applied to any diff/code snippet before it is included in an LLM prompt, as a
   defense-in-depth measure alongside `.gitignore`/path-exclusion.

7. **Package naming (Finding 7)** — Use unscoped package names: `docsync-core`, `docsync-cli`,
   `docsync-vscode-extension` (npm workspaces), avoiding the unpublished `@docsync/*` scope implication.

8. **Config defaults (Finding 8)** — If `docsync.config.json` is absent, the CLI/extension uses built-in defaults
   (scan whole repo, all 4 adapters enabled, `medium` severity blocks merge, mock provider if no API key) and logs
   that defaults are in effect.

## 3. Architecture Updates Required
- [x] Update `architecture.md`: package names, base-vs-head diff detail, concrete drift rule table, per-type
      linkage convention, LLM fallback behavior, secret redaction step, config defaults.

## 4. Sign-off
Design accepted for implementation planning (Step 4) with the above resolutions incorporated.
