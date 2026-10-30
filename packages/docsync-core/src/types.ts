/**
 * Shared types/models used across the DocSync-Bot core engine.
 */

import { ConfluenceClient } from "./confluence/confluenceClient";

export type DocType = "docstring" | "markdown" | "openapi" | "confluence";

export type Severity = "high" | "medium" | "low";

/** A single function/method/class parameter extracted from source code. */
export interface ParamModel {
  name: string;
  type?: string;
  optional?: boolean;
}

/** A normalized representation of a code symbol (function, method, or class) used for drift comparison. */
export interface SymbolModel {
  /** Stable identifier, e.g. "src/math.ts#add" */
  id: string;
  name: string;
  filePath: string;
  kind: "function" | "method" | "class";
  params: ParamModel[];
  returnType?: string;
  /** Raw source text of the symbol body, used for the ">30% line delta" heuristic. */
  bodyText: string;
  /** Existing docstring/JSDoc text attached to the symbol, if any. */
  docComment?: string;
}

/** Result of diffing a symbol between the base and head revisions. */
export interface SymbolChange {
  symbolId: string;
  changeType: "added" | "removed" | "modified" | "unchanged";
  base?: SymbolModel;
  head?: SymbolModel;
}

/** Normalized representation of a documentation artifact regardless of underlying doc type. */
export interface DocModel {
  docType: DocType;
  /** The doc-type-specific location: file path, OpenAPI operation path+method, or Confluence page ID. */
  location: string;
  /** Linked symbol ID, resolved by LinkResolver. */
  symbolId?: string;
  /** Parameters as currently documented (for docstring/markdown/openapi adapters). */
  documentedParams?: ParamModel[];
  documentedReturnType?: string;
  /** Free-form description text, used as LLM context and for rendering suggestions. */
  description?: string;
  /** Raw original content, needed to render a full before/after diff. */
  rawContent: string;
}

/** A detected mismatch between code and documentation. */
export interface DriftFinding {
  symbolId: string;
  docType: DocType;
  severity: Severity;
  reason: string;
  change: SymbolChange;
  doc?: DocModel;
}

/** An AI-generated (or fallback detection-only) proposed fix for a DriftFinding. */
export interface Suggestion {
  finding: DriftFinding;
  /** Present only when an LLMProvider produced content; absent in detection-only fallback mode. */
  proposedContent?: string;
  before: string;
  after?: string;
  source: "llm" | "detection-only";
  /** Populated by the Validator if claims could not be verified against the real signature. */
  validationWarnings: string[];
}

/** Common interface every documentation-type adapter must implement. */
export interface DocAdapter {
  docType: DocType;
  /** Parses a raw file/page's content into zero or more DocModel entries. */
  parse(content: string, location: string): DocModel[];
  /** Renders a DocModel back into raw content (used to build before/after diffs). */
  render(model: DocModel): string;
}

/** Abstraction over any LLM backend used to generate documentation suggestions. */
export interface LLMProvider {
  name: string;
  generate(prompt: string): Promise<string>;
}

export interface DocSyncConfigLinkage {
  symbolId: string;
  confluencePageId: string;
}

export interface DocSyncConfig {
  /** Glob patterns of files/folders to exclude from analysis. */
  excludePaths: string[];
  /** Which doc-type adapters are active. */
  enabledAdapters: DocType[];
  /** Minimum severity that causes the CLI/Action to fail (block merge). */
  blockingSeverity: Severity;
  /** Explicit symbol -> Confluence page mappings (Confluence pages can't carry inline ref tags). */
  confluenceLinks: DocSyncConfigLinkage[];
}

export const DEFAULT_CONFIG: DocSyncConfig = {
  excludePaths: ["node_modules/**", "dist/**", "**/*.test.ts"],
  enabledAdapters: ["docstring", "markdown", "openapi", "confluence"],
  blockingSeverity: "medium",
  confluenceLinks: []
};

export interface CheckOptions {
  /** Absolute path to the repository root (used for config loading, git ops, and repo scanning). */
  repoRoot: string;
  /** Base git ref/sha to diff from. */
  base: string;
  /** Head git ref/sha to diff to. */
  head: string;
  /** Overrides the LLM provider; defaults to `resolveLLMProviderFromEnv()` (may be undefined). */
  llmProvider?: LLMProvider;
  /** Overrides the Confluence client; defaults to `resolveConfluenceClientFromEnv()` (may be undefined). */
  confluenceClient?: ConfluenceClient;
}

export interface CheckResult {
  config: DocSyncConfig;
  changes: SymbolChange[];
  findings: DriftFinding[];
  suggestions: Suggestion[];
  /** Whether a real LLM provider was used (false means suggestions are detection-only). */
  usedLLM: boolean;
  /** Whether findings exceed the configured blocking severity threshold (FR-18). */
  blocking: boolean;
}
