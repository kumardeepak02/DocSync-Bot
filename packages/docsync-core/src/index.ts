import { DocstringAdapter, MarkdownAdapter, OpenApiAdapter, ConfluenceAdapter } from "./adapters";
import { resolveConfluenceClientFromEnv } from "./confluence/confluenceClient";
import { diffSymbols } from "./diff/diffAnalyzer";
import { GitDiffSource } from "./diff/gitSource";
import { scanRepoDocs } from "./discovery/repoScanner";
import { detectDrift } from "./drift/driftDetector";
import { shouldBlock } from "./drift/severity";
import { loadConfig } from "./link/config";
import { groupDocsBySymbol, resolveLinks } from "./link/linkResolver";
import { resolveLLMProviderFromEnv } from "./llm/githubModelsProvider";
import { generateSuggestions } from "./suggestion/suggestionEngine";
import { CheckOptions, CheckResult, DocModel, DocSyncConfig } from "./types";

async function collectDocs(
  options: CheckOptions,
  config: DocSyncConfig,
  changedFiles: Awaited<ReturnType<GitDiffSource["getChangedFiles"]>>
): Promise<DocModel[]> {
  const docs: DocModel[] = [];

  if (config.enabledAdapters.includes("docstring")) {
    for (const file of changedFiles) {
      if (!file.headContent) continue;
      docs.push(...DocstringAdapter.parse(file.headContent, file.filePath));
    }
  }

  if (config.enabledAdapters.includes("markdown") || config.enabledAdapters.includes("openapi")) {
    for (const scanned of scanRepoDocs(options.repoRoot, config)) {
      if (scanned.docType === "markdown" && config.enabledAdapters.includes("markdown")) {
        docs.push(...MarkdownAdapter.parse(scanned.content, scanned.relativePath));
      } else if (scanned.docType === "openapi" && config.enabledAdapters.includes("openapi")) {
        try {
          docs.push(...OpenApiAdapter.parse(scanned.content, scanned.relativePath));
        } catch {
          // Not a valid OpenAPI document (just a plain YAML file) — skip it.
        }
      }
    }
  }

  if (config.enabledAdapters.includes("confluence") && config.confluenceLinks.length > 0) {
    const client = options.confluenceClient ?? resolveConfluenceClientFromEnv();
    if (client) {
      for (const link of config.confluenceLinks) {
        try {
          const raw = await client.fetchPage(link.confluencePageId);
          docs.push(...ConfluenceAdapter.parse(raw, link.confluencePageId));
        } catch {
          // Confluence unreachable/misconfigured — degrade gracefully (NFR-4) rather than failing the whole run.
        }
      }
    }
  }

  return docs;
}

/**
 * The single public entrypoint used by both `docsync-cli` and the VS Code extension: diffs the
 * given revisions, links changed symbols to their documentation, detects drift, and produces
 * suggestions (AI-generated when a provider is available, detection-only otherwise).
 */
export async function checkRepo(options: CheckOptions): Promise<CheckResult> {
  const config = loadConfig(options.repoRoot);

  const gitSource = new GitDiffSource(options.repoRoot);
  const changedFiles = await gitSource.getChangedFiles(options.base, options.head);
  const changes = diffSymbols(changedFiles);

  const docs = await collectDocs(options, config, changedFiles);
  const resolvedDocs = resolveLinks(docs, config);
  const docsBySymbol = groupDocsBySymbol(resolvedDocs);
  const findings = detectDrift(changes, docsBySymbol);

  const llmProvider = options.llmProvider ?? resolveLLMProviderFromEnv();
  const suggestions = await generateSuggestions(findings, llmProvider);

  return {
    config,
    changes,
    findings,
    suggestions,
    usedLLM: Boolean(llmProvider),
    blocking: shouldBlock(findings, config)
  };
}

export * from "./types";
export { GitDiffSource } from "./diff/gitSource";
export { diffSymbols, diffFileSymbols } from "./diff/diffAnalyzer";
export { parseTypeScript, parsePython } from "./diff/languageParsers";
export { ADAPTERS, DocstringAdapter, MarkdownAdapter, OpenApiAdapter, ConfluenceAdapter } from "./adapters";
export { loadConfig } from "./link/config";
export { resolveLinks, groupDocsBySymbol } from "./link/linkResolver";
export { detectDrift } from "./drift/driftDetector";
export { shouldBlock } from "./drift/severity";
export { MockLLMProvider } from "./llm/mockProvider";
export { GitHubModelsProvider, resolveLLMProviderFromEnv } from "./llm/githubModelsProvider";
export { generateSuggestions, buildPrompt } from "./suggestion/suggestionEngine";
export { validateSuggestion } from "./suggestion/validator";
export { redactSecrets } from "./util/redactSecrets";
export { scanRepoDocs } from "./discovery/repoScanner";
export { resolveConfluenceClientFromEnv, RestConfluenceClient } from "./confluence/confluenceClient";
export type { ConfluenceClient } from "./confluence/confluenceClient";
export { formatReport } from "./report/formatReport";
