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

---

## EPMCDMETST-47868 — Stays: Advanced Filters & Currency Viewing Options

- **Plan date:** 2026-11-07
- **Approval/source:** User-approved architecture for implementation planning, recorded in
  `architecture.md` section 9.10 and `design-review.md` findings DR-47868-01/02. Source requirements:
  `requirements.md` section 5, FR-27–FR-37 and NFR-23–NFR-25.
- **Approval boundary:** Planning approval is not production-release sign-off. Open Exchange Rates
  latest-rates API is the approved candidate, but its current update cadence, required pair coverage,
  plan limits, and terms must pass the verification task before provider integration.
- **Scope/assumptions:** Extend existing Stays search and API; conversion is display-only; use USD
  for absent/ambiguous/unsupported locales and per-tab `sessionStorage`; no historical/offline rate
  cache; preserve original/base-price fallback and notice. Use the approved 5-minute maximum rate
  age, 2-second per-attempt timeout, at most one retry for transient network/429/5xx failures, and
  5-second overall deadline. Reject invalid rates; use decimal arithmetic and ISO 4217 minor-unit
  precision with half-expand rounding. Apply only responses correlated to the current search and
  currency selection.
- **Priority key:** P0 protects correctness, security, or the approved external-integration gate;
  P1 delivers core user-visible behavior and operational confidence; P2 completes release-facing
  documentation and handoff.
- **Status key:** Ready tasks have no prerequisite tasks; Planned tasks have only defined
  implementation prerequisites; Blocked tasks cannot start because an explicit verification or
  approval gate has not passed.

### Ordered task list

| ID | Priority | Status | Task | Direct prerequisites | Priority rationale |
|---|---|---|---|---|---|
| EPMCDMETST-47868-T01 | P0 | Ready | Verify provider suitability | — | Mandatory FR-36/vendor terms gate before integration |
| EPMCDMETST-47868-T02 | P0 | Ready | Define search and conversion API contracts, including response correlation | — | Prevent stale or misapplied results |
| EPMCDMETST-47868-T03 | P1 | Ready | Centralize currency configuration | — | Avoid inconsistent supported-currency behavior |
| EPMCDMETST-47868-T04 | P1 | Ready | Implement server-side advanced filters | T02 | Core search behavior and result correctness |
| EPMCDMETST-47868-T05 | P0 | Ready | Integrate the verified provider adapter | T01, T03 | External dependency and credential/security risk |
| EPMCDMETST-47868-T06 | P0 | Planned | Implement rate validation, conversion, and fallback | T02, T03 | Monetary correctness and bounded failure behavior |
| EPMCDMETST-47868-T07 | P1 | Planned | Build advanced-filter UI and reset behavior | T02, T04 | User-visible filter workflow |
| EPMCDMETST-47868-T08 | P1 | Planned | Implement locale default and per-tab currency state | T02, T03 | Consistent results-to-details selection behavior |
| EPMCDMETST-47868-T09 | P0 | Planned | Integrate asynchronous conversion through the existing API | T02, T06 | Keep initial results responsive and currency responses safe |
| EPMCDMETST-47868-T10 | P1 | Planned | Render converted/fallback prices on results and details | T08, T09 | Complete the display-currency user journey |
| EPMCDMETST-47868-T11 | P1 | Planned | Add rate and fallback observability | T06, T09 | Detect provider degradation and fallback trends |
| EPMCDMETST-47868-T12 | P0 | Planned | Verify feature, contract, and failure behavior end to end | T04, T05, T06, T07, T08, T09, T10, T11 | Prove correctness before rollout |
| EPMCDMETST-47868-T13 | P1 | Planned | Run provider-outage/load validation and set operating thresholds | T12 | Validate resilience and operational readiness |
| EPMCDMETST-47868-T14 | P1 | Planned | Exercise staged rollout and rollback | T13 | Reduce deployment risk |
| EPMCDMETST-47868-T15 | P2 | Planned | Publish implementation/API and operations handoff documentation | T02, T03, T11, T14 | Ensure supportable release and traceable decisions |

### Deliverables and acceptance criteria

1. **EPMCDMETST-47868-T01 — Verify provider suitability**
   - **Deliverable:** Record dated evidence for the candidate's publication cadence, supported
     base/target currency pairs needed by inventory, current plan limits, and contractual terms
     against FR-36 and expected request volume.
   - **Acceptance:** All required pairs and terms meet the requirement and rate policy, or the task
     records a failed gate and requests an approved alternative-provider decision. No provider
     integration starts on an unverified assumption.

2. **EPMCDMETST-47868-T02 — Define search and conversion API contracts**
   - **Deliverable:** Specify the existing API contract for advanced-filter search, the provider
     adapter interface, and the separate conversion request/response, including search revision,
     currency-selection revision, requested currency, and echoed response values; define how the
     active search/selection is identified.
   - **Acceptance:** Contract tests demonstrate that matching responses can be applied and responses
     for an older search, older currency selection, or different currency are rejected/discarded.
     Existing authentication/authorization applies and no provider secret reaches the client.

3. **EPMCDMETST-47868-T03 — Centralize currency configuration**
   - **Deliverable:** Central supported currency configuration with ISO alpha/numeric codes,
     locale/display metadata, standard minor-unit precision, and configured USD fallback.
   - **Acceptance:** UI and service consume the same configuration; unsupported locale resolution
     deterministically selects USD; adding a supported currency does not require duplicating a list.

4. **EPMCDMETST-47868-T04 — Implement server-side advanced filters**
   - **Deliverable:** Extend the existing search/filter service and API for cancellation policy,
     meal plan, guest rating, distance, property type, amenities, and payment options.
   - **Acceptance:** Tests cover all seven categories, AND across categories, OR within a category,
     kilometer-radius distance, minimum guest rating, supported-value validation, and reset
     preserving basic filters.

5. **EPMCDMETST-47868-T05 — Integrate the verified provider adapter**
   - **Deliverable:** Server-side provider adapter using TLS, protected server-side credentials,
     request/response parsing, and only the verified provider capabilities.
   - **Acceptance:** Integration is enabled only after T01 passes; secrets are absent from client
     bundles, responses, and logs. If T01 fails, this task remains blocked until an alternative
     provider is documented and approved. **Current blocker:** T01 provider due diligence has not
     yet passed.

6. **EPMCDMETST-47868-T06 — Implement rate validation, conversion, and fallback**
   - **Deliverable:** Implement the conversion policy behind the provider interface from T02.
     Enforce finite-positive rates, reject future timestamps and rates older than
     five minutes, and apply the 2-second per-attempt timeout, at most one retry for transient
     network/429/5xx failures, and a 5-second total deadline including retry delay. Respect
     `Retry-After` only if it fits within the deadline. Convert with decimal arithmetic and round to
     ISO 4217 minor-unit precision using half-expand; do not retain historical/offline rates.
   - **Acceptance:** With a test provider adapter, unit tests cover invalid/future/expired rates,
     timeout, retry eligibility, deadline exhaustion, each required base/target pair, differing
     currency minor units, rounding boundaries, and exact original/base-price fallback with an
     explanatory notice. Booking/payment amounts remain unchanged.

7. **EPMCDMETST-47868-T07 — Build advanced-filter UI and reset behavior**
   - **Deliverable:** Add the advanced-filter panel, active chips/tags, apply behavior, and clear/reset
     action while retaining the existing basic-filter selections.
   - **Acceptance:** UI tests cover all seven criteria, selected chips, result refresh, and advanced
     reset without clearing basic filters.

8. **EPMCDMETST-47868-T08 — Implement locale default and per-tab currency state**
   - **Deliverable:** Resolve locale currency when no explicit selection exists, use configured USD
     for missing/ambiguous/unsupported mappings, and persist the manual selection in same-tab
     `sessionStorage` through results-to-details navigation.
   - **Acceptance:** Tests cover absent, ambiguous, supported, and unsupported locales; manual choice
     takes precedence; same-tab navigation retains it and tab-session end clears it; cross-tab
     persistence is not introduced.

9. **EPMCDMETST-47868-T09 — Integrate asynchronous conversion through the existing API**
   - **Deliverable:** Add the separate conversion request and server-side orchestration without
     delaying initial search results; propagate and echo correlation values from T02.
   - **Acceptance:** Results render before rate completion; the API applies existing authorization,
     keeps provider access server-side, returns converted or fallback values with correlation
     fields, and does not cache historical/offline rates.

10. **EPMCDMETST-47868-T10 — Render converted/fallback prices on results and details**
    - **Deliverable:** Render prices using the selected currency and locale; keep original/base
      currency clearly identified for unavailable conversions on both results and details.
    - **Acceptance:** Only a response matching the active search revision, currency-selection
      revision, and currency updates the view; obsolete responses are ignored. Details use the same
      tab selection and fallback behavior; display conversion never changes checkout currency.

11. **EPMCDMETST-47868-T11 — Add rate and fallback observability**
    - **Deliverable:** Add sanitized measures for rate lookup latency, provider errors, and fallback
      frequency, plus dashboards/alerts or the established platform equivalent.
    - **Acceptance:** Signals distinguish success, timeout, provider error, invalid/expired rate,
      and fallback without logging credentials or sensitive traveler data; operational owners define
      thresholds without implying a new SLA.

12. **EPMCDMETST-47868-T12 — Verify feature, contract, and failure behavior end to end**
    - **Deliverable:** Automated integration/contract coverage across filters, currency selection,
      asynchronous responses, conversion, fallback, and details navigation.
    - **Acceptance:** Cover rapid selection changes and out-of-order responses; mixed base currencies;
      supported/unsupported pairs; malformed, future, expired, missing, and unavailable rates;
      retry/deadline behavior; per-tab persistence; initial results responsiveness; and no change to
      booking/payment amounts. No historical/offline rate cache is introduced.

13. **EPMCDMETST-47868-T13 — Run provider-outage/load validation and set operating thresholds**
    - **Deliverable:** Provider-outage, rate-limit, latency, concurrency, and search-load results
      with operational thresholds agreed by implementation/operations owners.
    - **Acceptance:** Results show initial search remains available during provider failure, bounded
      provider work falls back as specified, observability captures the failure modes, and agreed
      thresholds and remaining risks are documented.

14. **EPMCDMETST-47868-T14 — Exercise staged rollout and rollback**
    - **Deliverable:** Staged enablement plan, compatibility/configuration checks, rollback procedure,
      and evidence from a rehearsal or approved deployment validation.
    - **Acceptance:** Rollout stages and rollback triggers/owners are explicit; rollback restores the
      prior behavior without changing booking/payment currency or depending on historical rates.

15. **EPMCDMETST-47868-T15 — Publish implementation/API and operations handoff documentation**
    - **Deliverable:** Document API correlation fields, provider configuration/secrets handling,
      currency/fallback behavior, operational signals, thresholds, rollout, and rollback.
    - **Acceptance:** Documentation matches implemented and verified behavior, identifies the
      provider-verification evidence and operational owner, and does not describe unverified vendor
      suitability as a fact.

### Dependencies, blockers, and parallel work

- **Current explicit blocker:** T05 is blocked by T01 passing provider cadence, pair-coverage,
  plan-limit, and terms verification. If the candidate fails any check, provider integration stays
  blocked until an alternative is approved; no provider substitution is assumed.
- T01, T02, and T03 can proceed in parallel. T04 follows T02; T07 can proceed once T02 and T04 are complete;
  T08 can proceed once T02 and T03 are complete.
- After T01 and T03, T05 implements the verified provider adapter. T06 can be implemented against
  the T02 provider interface and a test adapter in parallel with T05. T09 uses the currency-service
  interface and joins T02 with T06; T10 combines T08 and T09. T12 verifies the concrete provider
  integration alongside the complete feature.
- T11 can proceed after T06 and T09. T12 joins completed filter, currency, conversion, UI, and
  observability work; T13, T14, and T15 follow the verification/operational readiness gates shown
  above.
- All prerequisite IDs in the task list are defined above; the dependency graph is acyclic.

### Verification approach

Use focused unit, API contract, UI, and integration tests at each task; then run the cross-feature,
provider-outage, load, and rollout/rollback validation in T12–T14. Verify FR-27–FR-37 and NFR-23–NFR-25,
including no blocking of initial results, no provider credentials in client/log output, no
historical/offline rate cache, stale-response rejection, exact fallback presentation, observability,
and unchanged booking/payment amounts. Confirm T01 evidence before enabling provider integration.
