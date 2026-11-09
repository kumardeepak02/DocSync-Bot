import { redactSecrets } from "../util/redactSecrets";
import { DriftFinding, LLMProvider, Suggestion } from "../types";
import { validateSuggestion } from "./validator";

function formatParams(params: { name: string; type?: string }[]): string {
  return params.map((p) => (p.type ? `${p.name}: ${p.type}` : p.name)).join(", ");
}

/** Renders a doc-type-aware prompt describing the drift and asking for corrected documentation. */
export function buildPrompt(finding: DriftFinding): string {
  const head = finding.change.head;
  const signature = head ? `${head.name}(${formatParams(head.params)}): ${head.returnType ?? "void"}` : "(removed)";
  const lines = [
    `Documentation type: ${finding.docType}`,
    `Drift reason: ${finding.reason}`,
    `Current signature: ${signature}`,
    `Existing documentation content:`,
    finding.doc?.rawContent ?? "(none — this symbol has no documentation yet)",
    "",
    "Rewrite the documentation content so it accurately reflects the current signature. Reply with only the corrected documentation content."
  ];
  return redactSecrets(lines.join("\n"));
}

/**
 * Turns `DriftFinding`s into `Suggestion`s. Falls back to `detection-only` mode (no generated
 * content) when no `LLMProvider` is supplied, per NFR-4 / design review Finding 5.
 */
export async function generateSuggestions(
  findings: DriftFinding[],
  provider: LLMProvider | undefined
): Promise<Suggestion[]> {
  const suggestions: Suggestion[] = [];

  for (const finding of findings) {
    const before = finding.doc?.rawContent ?? "";

    if (!provider) {
      suggestions.push({
        finding,
        before,
        source: "detection-only",
        validationWarnings: []
      });
      continue;
    }

    const prompt = buildPrompt(finding);
    const proposedContent = await provider.generate(prompt);
    const realParamNames = finding.change.head?.params.map((p) => p.name) ?? [];
    const symbolName = finding.change.head?.name ?? "";

    suggestions.push({
      finding,
      before,
      after: proposedContent,
      proposedContent,
      source: "llm",
      validationWarnings: validateSuggestion(proposedContent, realParamNames, symbolName)
    });
  }

  return suggestions;
}
