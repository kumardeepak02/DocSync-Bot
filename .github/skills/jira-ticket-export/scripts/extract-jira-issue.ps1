<#
.SYNOPSIS
  Parses a JIRA issue returned by the mcp-atlassian MCP tool (mcp_atlassian_mcp_jira_get_issue)
  and writes a complete, human-readable + full-fidelity dump to a text file.

.DESCRIPTION
  The MCP tool result is double-encoded JSON: either returned inline as a JSON string,
  or (for large issues) written to a file shaped like { "result": "<json-string>" }.
  This script un-wraps that and writes every field to -OutputPath so no detail is lost.

.PARAMETER ContentJsonPath
  Path to the "content.json" file the tool wrote when the result was too large to inline.

.PARAMETER InlineResultJson
  The raw "result" string, when the tool returned the issue inline instead of writing a file.

.PARAMETER OutputPath
  Destination text file, e.g. "EPMCDMETST-47868.txt".
#>
param(
    [string]$ContentJsonPath,
    [string]$InlineResultJson,
    [Parameter(Mandatory = $true)]
    [string]$OutputPath
)

if ($ContentJsonPath) {
    $raw = Get-Content -Raw -Path $ContentJsonPath
    $outer = $raw | ConvertFrom-Json
    $resultStr = $outer.result
}
elseif ($InlineResultJson) {
    $resultStr = $InlineResultJson
}
else {
    throw "Provide either -ContentJsonPath or -InlineResultJson"
}

$issue = $resultStr | ConvertFrom-Json

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add("=== JIRA Ticket: $($issue.key) ===")
$lines.Add("Summary:      $($issue.summary)")
$lines.Add("Status:       $($issue.status.name)")
$lines.Add("Priority:     $($issue.priority.name)")
$lines.Add("Type:         $($issue.issuetype.name)")
$lines.Add("Assignee:     $($issue.assignee.display_name)")
$lines.Add("Reporter:     $($issue.reporter.display_name)")
$lines.Add("Labels:       $($issue.labels -join ', ')")
$lines.Add("Created:      $($issue.created)")
$lines.Add("Updated:      $($issue.updated)")
$lines.Add("URL:          $($issue.browse_url)")
$lines.Add("")
$lines.Add("--- Description ---")
$lines.Add("$($issue.description)")
$lines.Add("")

if ($issue.comments) {
    $lines.Add("--- Comments ---")
    foreach ($c in $issue.comments) {
        $lines.Add("[$($c.created) - $($c.author)]")
        $lines.Add("$($c.body)")
        $lines.Add("")
    }
}

$lines.Add("--- Full Raw Data (every field, for completeness) ---")
$lines.Add(($issue | ConvertTo-Json -Depth 20))

$lines -join "`r`n" | Out-File -FilePath $OutputPath -Encoding utf8
Write-Output "Wrote $($OutputPath) ($((Get-Item $OutputPath).Length) bytes)"
