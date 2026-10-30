# DocSync-Bot — Requirements

**User Story**: As a development team, we want code changes to automatically trigger detection and AI-assisted
updates of related documentation (docstrings, README/Markdown, OpenAPI specs, and Confluence/Wiki pages) during
the pull-request workflow, so that documentation never drifts out of sync with the code it describes.

**Deployment context**: VS Code extension, integrated with the GitHub pull-request lifecycle (trigger: PR
open/sync), with a manual on-demand command as a fallback trigger.

**MVP scope for this capstone build**: All four documentation types are implemented (docstrings, README/Markdown,
OpenAPI, Confluence/Wiki) via a shared pluggable adapter interface. A real LLM provider (GitHub Models/Copilot API)
is used for generation, with a deterministic mock provider used in automated tests.

---

## 1. Functional Requirements (FR)

### 1.1 Change Detection
- **FR-1**: Detect code changes within a pull request (diff of files, functions, signatures, parameters, return
  types, and exported symbols).
- **FR-2**: Maintain a mapping between code artifacts (functions, classes, modules, API endpoints) and the
  documentation artifacts that describe them (docstrings, README sections, OpenAPI specs, wiki pages).
- **FR-3**: Classify each detected code change as **doc-impacting** or **non-doc-impacting** (e.g., formatting-only
  changes, internal refactors with no public API change).
- **FR-4**: Flag documentation as **stale** when linked code changes are detected but no corresponding doc update
  is found in the same PR.

### 1.2 Documentation Analysis
- **FR-5**: Parse existing documentation (docstrings, Markdown, OpenAPI/Swagger YAML/JSON, Confluence/wiki pages)
  to extract structured content linked to specific code symbols.
- **FR-6**: Compute a semantic diff between current doc content and what the updated code implies (e.g., changed
  parameter list vs. documented parameters).
- **FR-7**: Support configurable doc-to-code linkage strategies (inline tags like `@docsync:ref`, convention-based
  matching, or an explicit mapping file).

### 1.3 AI-Assisted Generation & Update
- **FR-8**: Use an LLM to generate a proposed documentation update when a doc-impacting change is detected,
  preserving existing style/tone/formatting conventions.
- **FR-9**: Generate updates for: function/class docstrings, README usage examples, API reference entries
  (OpenAPI spec fields), changelog entries, and wiki page sections.
- **FR-10**: Produce a **diff-style suggestion** (not a silent overwrite) showing proposed before/after doc content.
- **FR-11**: Support configurable prompt templates per doc type/project to control tone, verbosity, and structure.
- **FR-12**: Cross-validate generated text against actual code signatures/types before suggesting it, to avoid
  hallucinated content.

### 1.4 Trigger & Workflow Integration
- **FR-13**: Automatically run analysis when a pull request is opened, synchronized (new commits pushed), or
  marked ready for review.
- **FR-14**: Support a manual on-demand trigger from within VS Code (command palette / context menu) to run sync
  analysis on the current branch or file.
- **FR-15**: Post PR-level feedback (check/status, inline PR comments, or a summary comment) listing stale docs
  and proposed fixes.
- **FR-16**: Allow a user to accept, edit, or reject each proposed doc update individually from the VS Code
  diff/review UI.
- **FR-17**: On acceptance, apply the change as a new commit (or suggested commit) to the same PR branch.
- **FR-18**: Optionally block PR merge (configurable, e.g., required status check) when unresolved doc drift
  exists above a configured severity threshold.

### 1.5 External Platform Integration
- **FR-19**: Support publishing/syncing updates to Confluence via its REST API, including authentication and
  page-version handling.
- **FR-20**: Support generating/updating OpenAPI specification files committed to the repository.
- **FR-21**: Integrate with the GitHub REST/PR API to read PR metadata, post comments, and read/write check-run
  statuses.

### 1.6 Configuration & Customization
- **FR-22**: Provide a project-level configuration file (`docsync.config.json`) defining: doc/code mappings,
  included/excluded paths, trigger behavior, severity thresholds, and target doc platforms.
- **FR-23**: Allow per-repository and per-folder override rules (monorepo support).
- **FR-24**: Allow users to configure which AI model/provider is used, including a self-hosted or
  enterprise-approved model endpoint.

### 1.7 Reporting & History
- **FR-25**: Maintain a log/history of detected drift, proposed changes, and resolutions (accepted/edited/
  rejected) per PR.
- **FR-26**: Provide a summary view of overall documentation health (e.g., % of modules with up-to-date docs).

---

## 2. Non-Functional Requirements (NFR)

### 2.1 Performance
- **NFR-1**: Analysis of a typical PR (≤ 50 changed files) completes within 60 seconds (excluding LLM latency).
- **NFR-2**: No blocking of the VS Code UI thread; all analysis/network calls run asynchronously/in background.
- **NFR-3**: LLM calls are batched/cached to minimize redundant generation for unchanged doc sections.

### 2.2 Reliability & Availability
- **NFR-4**: Degrade gracefully (skip AI suggestions, report detection-only results) if the LLM provider is
  unavailable or rate-limited.
- **NFR-5**: Never silently overwrite documentation without explicit user confirmation.
- **NFR-6**: PR-triggered checks have a defined timeout and configurable fail-open/fail-closed behavior (default:
  fail-open).

### 2.3 Security & Privacy
- **NFR-7**: Code/doc content sent to an LLM provider is transmitted over TLS only.
- **NFR-8**: Credentials/tokens (GitHub PAT, Confluence API key, LLM API key) are stored via environment
  variables/secret storage, never in plaintext config or logs, and never committed to source control.
- **NFR-9**: Support self-hosted/enterprise LLM endpoints as an alternative to public third-party APIs.
- **NFR-10**: Respect `.gitignore`/exclusion rules; allow explicit exclusion of sensitive files/folders.
- **NFR-11**: External API calls are auditable via logs that exclude sensitive payload content by default.

### 2.4 Usability
- **NFR-12**: Proposed documentation changes are presented as a standard diff, consistent with existing review UX.
- **NFR-13**: Default setup requires no more than 3 user actions.
- **NFR-14**: Error messages are actionable (e.g., "Confluence token expired — reconnect in Settings").

### 2.5 Maintainability & Extensibility
- **NFR-15**: Doc-type parsers/generators (docstring, Markdown, OpenAPI, wiki) are pluggable modules so new doc
  formats can be added without core changes.
- **NFR-16**: LLM provider integration is abstracted behind a provider-agnostic interface to allow swapping
  models/vendors with minimal code change.

### 2.6 Compatibility
- **NFR-17**: Support current and previous two major VS Code releases.
- **NFR-18**: Support common languages out of the box (TypeScript/JavaScript, Python, Java, Go) via an extensible
  parser interface.
- **NFR-19**: GitHub integration supports both GitHub.com and GitHub Enterprise Server.

### 2.7 Scalability
- **NFR-20**: Handle large/monorepo structures without requiring full-repo re-analysis on every change
  (incremental analysis).

### 2.8 Compliance & Auditability
- **NFR-21**: Automated doc changes committed by the bot are clearly attributed (distinct bot commit identity).
- **NFR-22**: Maintain an immutable audit trail of what changed, when, by which trigger, and whether AI-assisted
  or manual.

---

## 3. Assumptions & Constraints
- Repository is hosted on GitHub (or GitHub Enterprise); PRs are the primary review unit.
- An LLM API (GitHub Models/Copilot) is available; a mock provider is used for offline/automated testing.
- v1 documentation is English-only; i18n is out of scope.

## 4. Out of Scope (v1)
- Fully autonomous merging of doc changes without human review.
- Real-time (pre-commit, keystroke-level) doc sync — v1 is PR-level and on-demand only.
- Generating documentation for undocumented legacy code with no existing doc anchor ("doc bootstrap").
