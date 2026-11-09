---
name: jira-ticket-export
description: 'Connect to JIRA via the configured MCP server (mcp-atlassian), fetch a ticket by its ticket number, read every field (summary, description, status, priority, labels, comments, acceptance criteria, etc.), and export the full details to a text file named "<TICKET-NUMBER>.txt". Use when the user asks to read/fetch/export a JIRA ticket, pull a user story from JIRA, or save ticket details to a file.'
argument-hint: 'JIRA ticket number, e.g. EPMCDMETST-47868'
---

# JIRA Ticket Export

## When to Use
- "Read ticket <KEY> from JIRA and save it to a file"
- "Export JIRA ticket <KEY> details"
- "Pull the user story <KEY> and write it to a text file"

## Prerequisites
- A JIRA MCP server must already be connected in this workspace (see [.vscode/mcp.json](../../../.vscode/mcp.json), server `mcp-atlassian`). If `tool_search` for `jira get issue atlassian mcp` returns no tools, tell the user to start/authenticate the MCP server first — do not attempt to hardcode credentials.
- Never write API tokens/credentials into any file created by this skill.

## Procedure

1. **Get the ticket number** from the user's request (pattern `[A-Z][A-Z0-9_]+-\d+`, e.g. `EPMCDMETST-47868`). Ask if missing.

2. **Load the tool**: run `tool_search` with query `jira get issue atlassian mcp` if `mcp_atlassian_mcp_jira_get_issue` isn't already available.

3. **Fetch full details** — request every field and all enrichments in one call so nothing is missed:
   ```
   mcp_atlassian_mcp_jira_get_issue(
     issue_key: "<TICKET-NUMBER>",
     fields: "*all",
     comment_limit: 100,
     include: "all"
   )
   ```

4. **Handle large results**: the tool may write its output to a `content.json` file instead of returning it inline (response says "Large tool result written to file: <path>"). That file has an outer `{ "result": "<json-string>" }` shape — the `result` value is itself JSON-encoded text (double-encoded), and `read_file` truncates long lines at ~2000 chars, so do NOT rely on `read_file` alone for big tickets.

5. **Create the output folder** at the workspace root if it does not already exist:
   ```powershell
   New-Item -ItemType Directory -Force -Path ".\Jira Requirements" | Out-Null
   ```

6. **Extract and format everything** using the bundled script, which parses the double-encoded JSON and writes a complete, human-readable dump (full field data, not truncated):
   ```powershell
   pwsh -File .github/skills/jira-ticket-export/scripts/extract-jira-issue.ps1 -ContentJsonPath "<path-from-step-4, or omit if result was inline>" -InlineResultJson "<raw result string, if returned inline>" -OutputPath ".\Jira Requirements\<TICKET-NUMBER>.txt"
   ```
   Run this via `run_in_terminal` (sync mode) directly — avoid routing through a subagent for this step, since the subagent may summarize/truncate instead of preserving full content.

7. **Place the output file** in the workspace-root `Jira Requirements` folder (or wherever the user specifies) and name it exactly `<TICKET-NUMBER>.txt` (e.g. `Jira Requirements\EPMCDMETST-47868.txt`).

8. **Confirm** to the user: file path created and a one-line summary of the ticket (summary + status), without repeating the entire dumped content back in chat.

## Notes
- If the user wants details for multiple tickets, repeat steps 3–6 per ticket, one file each.
- Do not delete or overwrite existing ticket export files without confirming — ask first if `<TICKET-NUMBER>.txt` already exists.
