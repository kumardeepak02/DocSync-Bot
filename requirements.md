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

---

## 5. EPMCDMETST-47868 — Stays: Advanced Filters & Currency Viewing Options

> **Note**: This ticket describes a travel-booking "Stays" search feature, a different product domain
> from DocSync-Bot's documentation-drift tooling (sections 1–4 above). It is captured here per explicit
> request; treat as a separate feature/product context within this document.

**User Story**: As a traveler searching for stays, I want to apply advanced stay filters and view all
prices in my preferred currency, so that I can quickly find relevant accommodation options and
understand costs in a familiar currency.

### 5.1 Functional Requirements (FR)
- **FR-27**: Provide an "Advanced filters" panel on the Stays search results page, additive to the
  existing basic filters.
- **FR-28**: Support advanced filter criteria: cancellation policy (free cancellation), meal plan, guest
  rating, distance, property type, amenities, and payment options.
- **FR-29**: Applying one or more advanced filters updates the results list to match the selected
  criteria and displays each applied filter as a visible active selection (e.g., chip/tag).
- **FR-30**: Provide a "Clear"/"Reset filters" action that returns all advanced filters to their default
  (unselected) state and refreshes the results list accordingly.
- **FR-31**: Provide a currency selector on the Stays search results page offering ISO-based currency
  codes (e.g., USD/840, EUR/978, GBP/826, AED/784, JPY/392) from a supported currency list.
- **FR-32**: Display currency options using the currency code only (e.g., "USD") in the selector UI.
- **FR-33**: On selecting a currency, convert and display all stay prices on the results page in the
  selected currency.
- **FR-34**: Persist the selected currency when navigating from the search results page to an
  individual stay's details page within the same session.
- **FR-35**: Default the displayed currency based on the user's device/browser locale when no explicit
  selection has been made.
- **FR-36**: Retrieve currency conversion rates from a real-time external exchange-rate API/provider.
- **FR-37**: When a conversion rate is unavailable for the selected currency, fall back to displaying
  prices in the original/base currency and show a notice explaining the fallback.

### 5.2 Non-Functional Requirements (NFR)
- **NFR-23**: Currency conversion rate lookups must not block the results page from rendering; fetch
  asynchronously/with caching, applying the FR-37 fallback if the external rate API is slow or
  unavailable (reliability).
- **NFR-24**: External exchange-rate API calls must use TLS, and rate-provider credentials/keys must
  never be exposed in client-side code (security).
- **NFR-25**: The supported currency list (ISO codes + numeric codes) must be centrally
  configurable/extensible so new currencies can be added without code changes (maintainability).

### 5.3 Assumptions & Constraints
- Currency selection affects display only; it does not change the actual payment/booking currency used
  at checkout.
- All seven advanced filter categories listed in FR-28 are confirmed in scope for this story.
- Manual currency selection, once made by the user, always overrides the device/browser locale default
  (FR-35) for the remainder of the session.

### 5.4 Out of Scope (this ticket)
- Multi-currency checkout/payment processing (display-only conversion, per 5.3).
- Historical/offline exchange-rate caching beyond what FR-37's fallback requires.
- Localization of filter labels/currency names beyond English (consistent with section 4's i18n
  exclusion).

---

## 6. EPMCDMETST-52508 — [BE] Document Intake and Validation for Multiple Document Formats

> **Note**: This ticket describes a document-intake feature, separate from DocSync-Bot's
> documentation-drift tooling and the travel-booking feature in section 5. It is captured here per
> explicit request as a separate product context.

**User Story**: As a system administrator, I want the system to validate and accept supported
document formats for processing so that valid documents enter the processing pipeline and invalid
files are rejected with appropriate errors.

### 6.1 Functional Requirements (FR)
- **FR-38**: Accept document uploads through both the batch upload interface and the API.
- **FR-39**: Support PDF files through PDF 2.0, Microsoft Word DOC and DOCX files, Rich Text Format
  (RTF) files, and Microsoft Excel XLS and XLSX files.
- **FR-40**: Detect document format from file signatures and validate that the detected format matches
  the file extension; reject uploads when they do not match.
- **FR-41**: Validate format-specific structure and integrity before accepting a document.
- **FR-42**: Accept files up to and including 100 MiB; reject larger files with a descriptive error.
- **FR-43**: Detect encrypted or password-protected documents and prompt for a password or provide
  appropriate password-required handling when needed.
- **FR-44**: Generate a unique DocumentID for each successfully accepted document.
- **FR-45**: Calculate and store an MD5 hash for document integrity verification.
- **FR-46**: Extract and store the filename, file size, upload date, and detected document format.
- **FR-47**: Store each accepted original file and persist its storage path/reference and DocumentFormat
  in the document record.
- **FR-48**: Return a success confirmation containing the DocumentID for accepted documents and
  descriptive errors for validation failures.

### 6.2 Non-Functional Requirements (NFR)
- **NFR-26**: After a file of up to 100 MiB has been received, validation, hashing, metadata
  extraction, and persistence must complete within 30 seconds under the expected deployment
  configuration.
- **NFR-27**: Sanitize and validate uploaded input to prevent injection attacks.
- **NFR-28**: Passwords supplied for protected documents must be transmitted over TLS and must not be
  stored or logged.

### 6.3 Assumptions & Constraints
- The relational database and file storage are configured, accessible, and have sufficient capacity;
  required document-parsing libraries are installed.
- The upload paths include both the batch upload interface and API, as clarified by the requester.
- The maximum accepted file size is 100 MiB, as clarified by the requester.
- Extension/signature mismatches are rejected, as clarified by the requester.
- The ticket does not specify which protected document formats support password entry or the exact
  password submission/prompt flow.

### 6.4 Out of Scope (this ticket)
- No additional out-of-scope items are specified in the ticket.
