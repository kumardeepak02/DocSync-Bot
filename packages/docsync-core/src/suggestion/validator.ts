const BACKTICK_IDENTIFIER_RE = /`([A-Za-z_][A-Za-z0-9_]*)`/g;

/**
 * Cross-checks generated documentation text against the real parameter names (and the symbol
 * name) to catch obviously hallucinated identifiers (FR-12). This is a best-effort heuristic, not
 * a full semantic check: it only flags backtick-quoted identifiers that don't match anything real.
 */
export function validateSuggestion(
  generatedText: string,
  realParamNames: string[],
  symbolName: string
): string[] {
  const warnings: string[] = [];
  const known = new Set([...realParamNames, symbolName]);
  let match: RegExpExecArray | null;
  BACKTICK_IDENTIFIER_RE.lastIndex = 0;

  while ((match = BACKTICK_IDENTIFIER_RE.exec(generatedText)) !== null) {
    const identifier = match[1];
    if (!known.has(identifier)) {
      warnings.push(`Generated text references \`${identifier}\`, which is not a real parameter or the symbol name — please review before accepting.`);
    }
  }

  return warnings;
}
