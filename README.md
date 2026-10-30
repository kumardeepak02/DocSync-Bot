# DocSync-Bot

AI-assisted documentation sync for code changes — detects when a pull request's code changes make existing
documentation (docstrings, README/Markdown, OpenAPI specs, Confluence pages) stale, and proposes AI-generated
fixes for human review.

> Built as a GitHub Copilot Agentic SDLC capstone exercise. See [requirements.md](./requirements.md),
> [architecture.md](./architecture.md), [design-review.md](./design-review.md), [impl-plan.md](./impl-plan.md),
> and [code-review.md](./code-review.md) for the full design/process trail.

## How it works

```
GitHub PR (opened/synced)  ──▶  docsync-cli check  ──▶  PR comment + check status
VS Code command            ──▶  docsync-core (in-process)  ──▶  Output channel + webview diff
```

1. **Detect** — diffs the base/head git revisions and extracts changed function/class signatures
   (TypeScript/JavaScript via `ts-morph`, Python via regex).
2. **Link** — maps each changed symbol to its documentation: JSDoc/docstrings (same file), Markdown sections
   (`<!-- docsync:ref <symbolId> -->`), OpenAPI operations (`x-docsync-ref` vendor extension), or Confluence pages
   (explicit mapping in `docsync.config.json`).
3. **Detect drift** — flags mismatched parameters/return types (high), undocumented new symbols (medium), or
   significant body changes with stable signatures (low).
4. **Suggest** — an LLM (GitHub Models/Copilot inference API) proposes corrected documentation; falls back to
   detection-only output when no provider is configured.
5. **Report** — a Markdown report is posted as a PR comment (CLI/Action) or rendered in a VS Code webview
   (extension). Nothing is ever applied automatically — every suggestion requires explicit human acceptance.

## Packages

| Package | Purpose |
|---|---|
| [`packages/docsync-core`](./packages/docsync-core) | Diff analysis, doc-type adapters, drift detection, LLM suggestion engine, public `checkRepo()` API. |
| [`packages/docsync-cli`](./packages/docsync-cli) | `docsync-cli check --base <ref> --head <ref>` — used by the GitHub Action. |
| [`packages/docsync-vscode-extension`](./packages/docsync-vscode-extension) | Thin VS Code command (`DocSync: Check Current Branch`) for on-demand checks. |

## Setup

```powershell
npm install
npm run build        # compiles all 3 workspace packages
npm test             # runs the full jest suite (75 tests)
```

Copy `.env.example` to `.env` and fill in values as needed:

- `GITHUB_MODELS_TOKEN` — enables real AI-generated suggestions. Without it, DocSync-Bot still detects drift but
  skips suggestion generation (detection-only mode).
- `CONFLUENCE_BASE_URL` / `CONFLUENCE_EMAIL` / `CONFLUENCE_API_TOKEN` — enables reading linked Confluence pages.

## Usage

### CLI

```powershell
node packages/docsync-cli/dist/index.js check --base <base-ref> --head <head-ref> --repo <path>
```

Exit codes: `0` = no blocking drift, `1` = blocking drift found, `2` = unexpected error.

### GitHub Action

[.github/workflows/docsync.yml](./.github/workflows/docsync.yml) runs the CLI automatically on
`pull_request: [opened, synchronize, ready_for_review]`, posts the report as a PR comment, and fails the job if
blocking drift is found. Add a `GITHUB_MODELS_TOKEN` repository secret to enable AI-generated suggestions.

### VS Code extension

Run **DocSync: Check Current Branch** from the Command Palette. Results appear in the "DocSync-Bot" Output
channel and a side-by-side webview panel.

## Configuration

Optional `docsync.config.json` at the repo root (see the one in this repo for a real example):

```json
{
  "excludePaths": ["node_modules/**", "dist/**", "**/*.test.ts"],
  "enabledAdapters": ["docstring", "markdown", "openapi", "confluence"],
  "blockingSeverity": "medium",
  "confluenceLinks": [{ "symbolId": "src/file.ts#fn", "confluencePageId": "123456" }]
}
```

If absent, built-in defaults are used (see `DEFAULT_CONFIG` in
[`packages/docsync-core/src/types.ts`](./packages/docsync-core/src/types.ts)).

## Known limitations

- Python signature extraction is regex-based, not a full AST parser (Java/Go adapters are not implemented).
- The VS Code extension is an intentionally thin stub (one command + simple webview), not a full inline-editor
  integration — see the MVP boundary agreed in [design-review.md](./design-review.md).
- Confluence integration currently supports reading linked pages for drift detection; writing updates back to
  Confluence is not implemented (would be a deliberate, explicit opt-in operation per the architecture).
- The "undocumented new symbol" rule fires for every newly added exported function/method, including small
  internal helpers — teams that don't document every helper may want to raise `blockingSeverity` or scope
  `excludePaths`, as this repo's own `docsync.config.json` does.
- A handful of transitive `jest`/`ts-jest` dev dependencies carry low-severity advisories (not shipped in any
  published artifact) — see [code-review.md](./code-review.md) for details.
