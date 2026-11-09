import * as vscode from "vscode";
import { checkRepo, formatReport } from "docsync-core";

const CANDIDATE_BASE_REFS = ["origin/main", "origin/master", "main", "master"];

async function resolveBaseRef(repoRoot: string): Promise<string> {
  // Thin stub: try common default-branch names rather than invoking git directly here — docsync-core
  // itself does the real ref resolution/validation when it shells out to git.
  for (const ref of CANDIDATE_BASE_REFS) {
    try {
      const { simpleGit } = await import("simple-git");
      await simpleGit(repoRoot).revparse([ref]);
      return ref;
    } catch {
      continue;
    }
  }
  return "HEAD~1";
}

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel("DocSync-Bot");

  const disposable = vscode.commands.registerCommand("docsync.checkCurrentBranch", async () => {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
      vscode.window.showErrorMessage("DocSync-Bot: open a folder/workspace first.");
      return;
    }

    const repoRoot = folder.uri.fsPath;
    output.show(true);
    output.appendLine("Running DocSync-Bot check...");

    try {
      const base = await resolveBaseRef(repoRoot);
      const result = await checkRepo({ repoRoot, base, head: "HEAD" });
      const report = formatReport(result);

      output.appendLine(report);

      const panel = vscode.window.createWebviewPanel(
        "docsyncReport",
        "DocSync-Bot Report",
        vscode.ViewColumn.Beside,
        { enableScripts: false }
      );
      panel.webview.html = renderWebviewHtml(report);

      if (result.findings.length === 0) {
        vscode.window.showInformationMessage("DocSync-Bot: no documentation drift detected.");
      } else {
        vscode.window.showWarningMessage(
          `DocSync-Bot: ${result.findings.length} documentation drift finding(s) detected${result.blocking ? " (blocking)" : ""}.`
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      output.appendLine(`Error: ${message}`);
      vscode.window.showErrorMessage(`DocSync-Bot check failed: ${message}`);
    }
  });

  context.subscriptions.push(disposable, output);
}

function renderWebviewHtml(markdownReport: string): string {
  const escaped = markdownReport
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<!DOCTYPE html>
<html>
  <body style="font-family: var(--vscode-font-family, sans-serif); padding: 1rem;">
    <pre style="white-space: pre-wrap;">${escaped}</pre>
  </body>
</html>`;
}

export function deactivate(): void {
  // No teardown needed: the output channel/command are disposed via context.subscriptions.
}
