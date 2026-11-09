---
name: ticket-confluence-architecture
description: 'Use when the System Architecture Designer agent passes a validated ticket number to create its high-level architecture diagram in Confluence. Check requirements.md, clarify ambiguities, then create a page in the Epam space.'
argument-hint: 'Validated ticket number supplied by the calling agent'
---

# Ticket Architecture in Confluence

Use the ticket number passed in by the calling agent. Clarify its requirements, create a titled
Confluence page first, then add a high-level architecture and diagram through the configured MCP
connection.

## Input and destination
- Source: workspace-root `requirements.md`.
- Input: the validated ticket number passed by `system-architecture-designer.agent.md`.
- Do not prompt for, normalize, or validate the ticket's format; the calling agent owns input
  collection and format validation. Use the supplied ticket unchanged in lookups and page title.
- Confluence site: `https://decentdkdeepak.atlassian.net/wiki`.
- Confluence space: `Epam`, using the configured Confluence MCP connection.
- Exact page title: `High-level diagram for EPMCDMETST-52508`, replacing the example ticket
  with the ticket supplied by the calling agent. Do not include quote marks around the ticket.

## Procedure
1. **Use the calling agent's ticket input.** Treat the ticket passed by
   `system-architecture-designer.agent.md` as the input for this run. Do not ask the user to enter
   it again or repeat format validation; if no ticket argument was passed, report that the calling
   agent must supply one and stop.
2. **Check `requirements.md`.** Search for the exact ticket in a requirements-section heading;
   reject substring matches (for example, `EPMCDMETST-52508` must not match `EPMCDMETST-525080`).
   If the file is missing, inaccessible, or has no matching section, tell the user:
   `Add the requirements for <TICKET-NUMBER> to requirements.md first, then retry.`
   Stop without fetching Jira or publishing.
3. **Read requirements thoroughly.** Read the entire matching ticket section, including all
   functional and non-functional requirements, assumptions, constraints, acceptance criteria and
   out-of-scope notes. Also read shared requirements that apply to this ticket. Read enough of the
   rest of `requirements.md` to identify relevant cross-cutting constraints, but do not mix
   unrelated ticket/product requirements into the design. Keep requirement IDs for traceability.
4. **Clarify all material ambiguities before designing.** Identify gaps, conflicts and unspecified
   decisions affecting scope, components, deployment, technologies, integrations, storage,
   performance, security, privacy, failure handling, data flows and diagram boundaries. Ask the
   questions in a concise batch, propose options where useful, and wait for answers. Ask follow-up
   questions until all material ambiguities are resolved; record accepted assumptions explicitly.
   Do not silently invent requirements or proceed if the user declines or leaves a blocking decision
   unanswered. The configured `Epam` space and exact title format are fixed; do not ask the user to
   choose a different space or title.
5. **Connect through Confluence MCP after clarification.** Discover/use the configured Confluence
   MCP tools. Verify access to the configured site and the `Epam` space with a read-only lookup.
   If the connection, space access or create permission is unavailable, report the blocker and ask
   the user to restore access; never request credentials in chat, edit MCP configuration, use Jira
   tools, or write through an unauthenticated browser.
6. **Create the new page first.** Use the exact title `High-level diagram for <TICKET-NUMBER>` in
   the `Epam` space. Search for that exact title before creation. If it already exists, do not
   silently overwrite it; ask whether the user wants to update the existing page or cancel. If
   creation is confirmed, create the page with a short placeholder stating that the clarified
   architecture diagram is being prepared. Capture the page ID/URL.
7. **Design the high-level architecture** from the clarified requirements. Prepare:
   - Ticket scope, source requirement IDs, goals and exclusions.
   - Architecture recommendation and deployment boundaries.
   - Component table listing each component, its responsibilities, interfaces and owned data.
   - Technology recommendations with rationale, trade-offs and alternatives.
   - A high-level component diagram and numbered end-to-end data flow, including relevant failure
     paths; include a sequence diagram when it clarifies interactions.
   - Data stores, external integrations, trust boundaries, authentication, and NFR coverage.
   - Decisions, user-approved assumptions, risks and requirement-to-component mapping.
   Distinguish requirements from recommendations; do not present guesses or unmeasured guarantees
   as facts.
8. **Add the architecture to the created page.** Use the supported Confluence MCP page-update tool
   to replace the placeholder with the clarified architecture recommendation, component
   responsibilities, technology choices, data flow, NFR coverage and diagram. Verify the supported
   Confluence diagram representation from tool documentation or page evidence; do not assume an
   unverified Mermaid macro or plain Markdown fences render as a diagram. If the configured
   Confluence tools cannot represent the diagram, report the blocker instead of claiming the
   diagram was added. Do not send diagrams to external rendering services.
9. **Verify and report.** Read the page back through MCP. Confirm the title, Epam space,
   architecture content and diagram are present; verify visible rendering if preview is available,
   otherwise say rendering is unverified. Report the successfully created page link and ticket.
   If page creation, update or verification fails, state the blocker and do not claim success.

## Boundaries
- This skill creates a Confluence page only; do not edit `architecture.md`, requirements, application
  code, commits or pushes unless separately requested.
- Respect content exclusions and never publish secrets or restricted content.
- Keep tool use focused; do not dump the full repository or invoke subagents for this workflow.
