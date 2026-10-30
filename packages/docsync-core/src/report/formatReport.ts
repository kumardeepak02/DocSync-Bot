import { CheckResult } from "../types";

const SEVERITY_EMOJI: Record<string, string> = { high: "🔴", medium: "🟠", low: "⚪" };

/**
 * Renders a `CheckResult` as a Markdown report (FR-15). Shared by both front doors —
 * `docsync-cli` posts it as a PR comment and the VS Code extension renders it in a webview — so
 * the two surfaces never diverge on what a finding/suggestion looks like.
 */
export function formatReport(result: CheckResult): string {
  if (result.findings.length === 0) {
    return "✅ **DocSync-Bot**: no documentation drift detected for this change.";
  }

  const lines: string[] = [
    `## 📄 DocSync-Bot report`,
    "",
    result.usedLLM
      ? "_AI-generated suggestions below — review each before accepting._"
      : "_No LLM provider configured: showing detection-only results (no AI-generated content)._",
    "",
    "| # | Severity | Doc Type | Symbol | Reason |",
    "|---|----------|----------|--------|--------|"
  ];

  result.findings.forEach((finding, index) => {
    lines.push(
      `| ${index + 1} | ${SEVERITY_EMOJI[finding.severity] ?? ""} ${finding.severity.toUpperCase()} | ${finding.docType} | \`${finding.symbolId}\` | ${finding.reason} |`
    );
  });

  lines.push("", "### Suggested changes", "");

  result.suggestions.forEach((suggestion, index) => {
    lines.push(`<details><summary>${index + 1}. ${suggestion.finding.symbolId} (${suggestion.finding.docType})</summary>`, "");
    if (suggestion.source === "detection-only") {
      lines.push("_No LLM provider configured — drift detected but no suggestion generated._");
    } else {
      lines.push("```diff", `- ${suggestion.before || "(no existing documentation)"}`, `+ ${suggestion.after}`, "```");
      if (suggestion.validationWarnings.length > 0) {
        lines.push("", "⚠️ **Validation warnings:**");
        suggestion.validationWarnings.forEach((w) => lines.push(`- ${w}`));
      }
    }
    lines.push("", "</details>", "");
  });

  lines.push(
    `---`,
    `**Status**: ${result.blocking ? "❌ blocking (severity ≥ " + result.config.blockingSeverity + ")" : "✅ not blocking"}`
  );

  return lines.join("\n");
}
