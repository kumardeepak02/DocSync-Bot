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

## EPMCDMETST-47868

### Review metadata and assessment

- Review date: 2026-11-07 (decision update to the current EPMCDMETST-47868 review; this replaces
  the prior ticket review).
- Reviewer: GitHub Copilot, senior system design reviewer.
- Architecture: [ticket section 9](architecture.md#9-epmcdmetst-47868--stays-advanced-filters--currency-viewing-options),
  sections 9.1-9.10, including the agreed separate conversion request through the existing API.
- Requirements: [ticket section 5](requirements.md#5-epmcdmetst-47868--stays-advanced-filters--currency-viewing-options),
  FR-27 through FR-37 and NFR-23 through NFR-25.
- Confluence reference in architecture: [High-level diagram for EPMCDMETST-47868](https://decentdkdeepak.atlassian.net/wiki/spaces/Epam/pages/18644993).
  Confluence was not accessed during this local-only re-review; prior verification is historical,
  not a current synchronization or rendering check.
- Scope: traceability, component/interface/data ownership, flows, failures/consistency, security,
  performance/scalability, external integration, testability, operations and rollout. The
  separate DocSync-Bot architecture and its preceding review are out of scope.
- Assessment: the architecture describes the required filter and display-currency capabilities
  and captures the decisions confirmed on 2026-11-07. The response-correlation contract and
  provider-policy proposal have now been approved for planning, along with rate validation/rounding.
  Provider suitability checks remain a pre-integration verification gate, not an unresolved
  architecture choice. Findings are design risks, not verified runtime defects.

### Findings

#### DR-47868-01 - High (Resolved) - Asynchronous response correlation and ordering unspecified

- Confidence: High.
- Evidence: architecture 9.2, 9.5 and 9.7 define separate conversion requests through the existing
  API. Before this decision update, the contract did not specify response correlation. Relevant
  requirements: FR-29, FR-33, FR-34; NFR-23.
- Impact: an older response could replace prices for a newer filter or currency choice; the
  architecture diagram did not previously define an implementable interface contract.
- Recommendation: include search and currency-selection revisions plus requested currency, echo
  them in responses, discard obsolete responses, and test rapid selection changes and out-of-order
  completion. Keep provider credentials server-side. Transport is separate requests through the
  existing API.
- Status: Resolved. The user approved that correlation contract on 2026-11-07. The client applies a
  response only when search revision, currency-selection revision, and currency still match the
  active selection; obsolete responses are discarded. API and client behavior must be tested.

#### DR-47868-02 - Medium (Resolved; verification gate remains) - Rate validity, freshness and failure policy unspecified

- Confidence: High.
- Evidence: architecture 9.2 and 9.4 recommend a provider integration; before this update, the
  architecture did not have approved validity, age, timeout, or retry criteria. Requirements FR-36
  calls for a real-time provider; FR-37 requires original/base fallback
  when the selected rate is unavailable; NFR-23 allows asynchronous lookup/caching; section 5.4
  excludes historical/offline rate caching beyond fallback needs.
- Impact: a stale or malformed rate may be treated as usable, unbounded provider calls may linger,
  or caching may exceed the explicit scope boundary.
- Recommendation: verify provider cadence, pair support and terms before integration; enforce
  finite-positive/fresh-rate validation, bounded timeout/retry, decimal conversion and currency
  minor-unit rounding for heterogeneous base currencies. Do not retain historical/offline rates;
  use FR-37 fallback for unusable rates. Test missing/malformed rates, expiry, provider timeout/rate
  limits and mixed base currencies.
- Status: Resolved for planning by user approval on 2026-11-07: Open Exchange Rates latest-rates API
  candidate; maximum rate age 5 minutes; 2-second timeout per attempt; at most one retry for
  transient network/429/5xx failures; and 5-second total deadline. Reject non-finite, non-positive,
  future-dated, and expired rates. Use decimal arithmetic, ISO 4217 minor-unit precision, and
  half-expand rounding for display; require a supported rate for every needed base/target pair.
  Preserve original/base fallback and no historical/offline rate caching. Provider publication
  cadence, pair coverage, plan limits, and terms were not independently verified here and are a
  mandatory pre-integration gate; a failed check requires an approved provider decision.

#### DR-47868-03 - Medium (Resolved) - Unsupported locale default was unspecified

- Confidence: High.
- Evidence: architecture 9.6 infers a default from device/browser locale and 9.9 acknowledges a
  locale may not map to a supported currency, but no fallback is selected. Relevant requirements:
  FR-31, FR-35; NFR-25; section 5.3 says an explicit manual choice overrides locale for the session.
- Impact: absent, language-only or unsupported-region locales may produce inconsistent UI/service
  defaults or no selected display currency.
- Recommendation: centrally map supported locale regions and select an explicit fallback for
  unmatched locales while preserving a manual session choice. Candidate policies are a configured
  supported default or original/base display. Test absent, ambiguous and unsupported locales.
- Status: Resolved. Use configured USD for absent, ambiguous or unsupported locale mappings;
  manual session selection still overrides it (user, 2026-11-07).

#### DR-47868-04 - Medium (Resolved) - Session contract was unspecified

- Confidence: High.
- Evidence: architecture 9.3/9.4 say the selection is session-scoped, but no storage/lifetime or
  details resolution contract is defined. The sequence now includes original/base prices and a
  notice if conversion is unavailable (9.7/9.10). Relevant requirements: FR-34, FR-37; NFR-23;
  section 5.3.
- Impact: results and details could diverge in selected currency or fallback handling, and clients
  could interpret "same session" differently.
- Recommendation: keep the selected currency independent of rate availability, specify session
  scope/lifetime, and use the same conversion/fallback contract on details. Test navigation during
  a rate outage and manual-selection precedence.
- Status: Resolved. Use per-tab `sessionStorage` through same-tab results-to-details navigation,
  expiring when that tab's session ends; details use the same conversion/fallback behavior
  (user, 2026-11-07). The original/base fallback follows FR-34/FR-37.

#### DR-47868-05 - Low (Resolved) - Operational and rollout verification was unspecified

- Confidence: High for the documentation gap; operational impact is unmeasured.
- Evidence: architecture 9.8 includes functional and provider-outage tests but no operational
  signals, concurrency/load validation or rollout/rollback checks. Relevant requirements: FR-29,
  FR-37; NFR-23 through NFR-25.
- Impact: slow/outage provider behavior, frequent fallback, expensive filter queries, or invalid
  configuration may be difficult to detect or safely roll back.
- Recommendation: define sanitized latency/error/rate-response-age/fallback metrics, concurrency and
  provider-outage tests, config compatibility checks, and staged rollout/rollback validation.
  Confirm thresholds with operations; do not infer a new SLA.
- Status: Resolved at the architecture-expectation level. Monitor rate lookup latency, provider
  errors and fallback frequency; provider-outage/load testing and staged rollout with rollback are
  approved (user, 2026-11-07). Define implementation-specific coverage and thresholds with owners.

### Decision log

| State | Decision | Basis / confirmer |
|---|---|---|
| Agreed | Reuse existing Stays/search services; server-side AND across categories and OR within; kilometer radius; minimum guest rating; advanced reset preserves basic filters; manual currency overrides locale within session; use standard minor units; reuse existing authentication/authorization. | User's earlier "accept defaults"; recorded in architecture 9.9. |
| Requirement-derived clarification | Preserve currency choice separately from rate availability; details show original/base prices and an explanatory notice when conversion is unavailable. | FR-34/FR-37 and previously approved fallback behavior; architecture 9.7/9.10. |
| Agreed | Converted prices are requested separately through the existing API; provider remains server-side. | User's response on 2026-11-07; architecture 9.5-9.7 updated. |
| Agreed | No historical/offline rate caching beyond requirements section 5.4; expired or unavailable rates fall back to original/base prices with a notice. | User's response on 2026-11-07. |
| Agreed | Use centrally configured USD for unsupported/ambiguous locale mappings; manual session selection takes precedence. | User's response on 2026-11-07; architecture 9.4/9.6/9.10 updated. |
| Agreed | Store currency in per-tab `sessionStorage` through same-tab details navigation; clear when tab session ends. | User's response on 2026-11-07; architecture 9.3/9.4/9.10 updated. |
| Agreed | Monitor rate latency/errors/fallback frequency; perform provider-outage/load testing and staged rollout with rollback. | User's response on 2026-11-07; implementation-specific coverage/thresholds remain tasks. |
| Agreed for planning | Open Exchange Rates latest-rates API candidate, subject to pre-integration verification; max rate age 5 minutes; 2-second attempt timeout; at most one retry for transient network/429/5xx failures; 5-second overall deadline including retry delay. | User approval, 2026-11-07. Verify current cadence, pair coverage, plan limits and terms against FR-36 before integration; if any check fails, pause and seek approval for an alternative provider. |
| Agreed for planning | Conversion request/response correlation uses search revision, currency-selection revision, and requested currency; responses echo these fields and obsolete responses are discarded. | User approval, 2026-11-07; test rapid changes and out-of-order completion. |
| Agreed for planning | Reject non-finite, non-positive, future-dated, and over-5-minute-old rates; perform decimal conversion and round to ISO 4217 minor-unit precision using half-expand; validate every required base/target pair. | User approval, 2026-11-07; no historical/offline rate cache; original/base fallback and notice remain required. |
| Approved | Architecture approved for implementation planning; this is not production-release sign-off. | User confirmation, 2026-11-07; provider suitability remains a pre-integration gate. |

### Changes, verification, and follow-up

- Updated architecture section 9 with the approved response-correlation, provider-policy,
  rate-validation, and rounding decisions; retained the explicit provider due-diligence gate.
  Recorded approval for implementation planning, not release. No production code or requirements
  changed.
- Replaced the prior EPMCDMETST-47868 review section with this current review; unrelated review
  content is preserved.
- Local review only: no current Confluence synchronization, page render, production API, provider,
  load test or deployed security control was verified. The linked Confluence page and SVG are
  references from prior work, not evidence of current external synchronization; visual rendering
  was previously unverified.
- Before provider integration, verify current provider update cadence, required pair coverage, plan
  limits and terms. If any verification fails, obtain approval for an alternative provider before
  proceeding. No vendor suitability check was performed as part of this local review.
- Before release, validate timeout/retry and rate-validation boundaries, response ordering,
  mixed-currency conversion/rounding, session navigation, configuration, concurrency/load, outage
  behavior and rollback; confirm operational ownership and thresholds.
