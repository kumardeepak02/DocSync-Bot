import { bodyLineDeltaRatio } from "../diff/diffAnalyzer";
import { DocModel, DriftFinding, ParamModel, SymbolChange } from "../types";

function paramsMatch(documented: ParamModel[], actual: ParamModel[]): boolean {
  // An empty documented-params list means the author never itemized parameters (e.g. a
  // prose-only JSDoc comment with no @param tags) — that's a valid authoring style, not drift, so
  // there is nothing to compare against. Only an itemized list that stops matching the code is
  // treated as drift. (Found via dogfooding this tool against its own codebase — see Step 7.)
  if (documented.length === 0) return true;
  if (documented.length !== actual.length) return false;
  return documented.every((p, i) => p.name === actual[i].name);
}

/**
 * Applies the concrete drift rules agreed in the design review (architecture.md §3.1) to a single
 * symbol change plus whatever docs are linked to it. Returns zero or more findings — a symbol can
 * have multiple linked doc artifacts (e.g. a docstring AND a README section).
 */
function findingsForSymbol(change: SymbolChange, linkedDocs: DocModel[]): DriftFinding[] {
  if (change.changeType === "unchanged" || change.changeType === "removed") return [];

  if (change.changeType === "added") {
    if (linkedDocs.length > 0) return checkDocsAgainstHead(change, linkedDocs);
    return [
      {
        symbolId: change.symbolId,
        docType: "docstring",
        severity: "medium",
        reason: `New exported symbol '${change.head?.name}' was added with no linked documentation.`,
        change
      }
    ];
  }

  // changeType === "modified"
  if (linkedDocs.length === 0) return [];
  return checkDocsAgainstHead(change, linkedDocs);
}

function checkDocsAgainstHead(change: SymbolChange, linkedDocs: DocModel[]): DriftFinding[] {
  const head = change.head;
  if (!head) return [];

  const findings: DriftFinding[] = [];
  const bodyChanged =
    change.base !== undefined && bodyLineDeltaRatio(change.base.bodyText, head.bodyText) > 0.3;

  for (const doc of linkedDocs) {
    const documentedParams = doc.documentedParams ?? [];
    if (!paramsMatch(documentedParams, head.params)) {
      findings.push({
        symbolId: change.symbolId,
        docType: doc.docType,
        severity: "high",
        reason: `Documented parameters [${documentedParams.map((p) => p.name).join(", ")}] no longer match the code's parameters [${head.params.map((p) => p.name).join(", ")}].`,
        change,
        doc
      });
      continue;
    }

    if (doc.documentedReturnType !== undefined && doc.documentedReturnType !== (head.returnType ?? "")) {
      findings.push({
        symbolId: change.symbolId,
        docType: doc.docType,
        severity: "high",
        reason: `Documented return type '${doc.documentedReturnType}' no longer matches the code's return type '${head.returnType ?? "(none)"}'.`,
        change,
        doc
      });
      continue;
    }

    if (bodyChanged) {
      findings.push({
        symbolId: change.symbolId,
        docType: doc.docType,
        severity: "low",
        reason: "The function body changed significantly; the documented description has not been re-verified.",
        change,
        doc
      });
    }
  }

  return findings;
}

/** Applies the drift rules across every symbol change, given a symbolId -> linked DocModel[] map. */
export function detectDrift(changes: SymbolChange[], docsBySymbol: Map<string, DocModel[]>): DriftFinding[] {
  return changes.flatMap((change) => findingsForSymbol(change, docsBySymbol.get(change.symbolId) ?? []));
}
