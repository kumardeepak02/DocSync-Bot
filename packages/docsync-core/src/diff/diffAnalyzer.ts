import { SymbolModel, SymbolChange } from "../types";
import { parsePython, parseTypeScript } from "./languageParsers";

/** One file's content at both the base and head revision, as provided by a diff source. */
export interface FileVersionPair {
  filePath: string;
  baseContent: string | undefined;
  headContent: string | undefined;
}

function parseByExtension(filePath: string, content: string): SymbolModel[] {
  if (/\.(ts|tsx|js|jsx)$/.test(filePath)) return parseTypeScript(content, filePath);
  if (/\.py$/.test(filePath)) return parsePython(content, filePath);
  return [];
}

function bodyLineDeltaRatio(baseBody: string, headBody: string): number {
  const baseLines = baseBody.split(/\r?\n/).map((l) => l.trim());
  const headLines = headBody.split(/\r?\n/).map((l) => l.trim());
  const baseSet = new Set(baseLines.filter((l) => l.length > 0));
  const headSet = new Set(headLines.filter((l) => l.length > 0));
  const maxLen = Math.max(baseSet.size, headSet.size, 1);
  let changed = 0;
  for (const line of headSet) if (!baseSet.has(line)) changed++;
  for (const line of baseSet) if (!headSet.has(line)) changed++;
  return changed / (2 * maxLen);
}

function signatureEquals(a: SymbolModel, b: SymbolModel): boolean {
  if (a.params.length !== b.params.length) return false;
  for (let i = 0; i < a.params.length; i++) {
    if (a.params[i].name !== b.params[i].name) return false;
    if ((a.params[i].type ?? "") !== (b.params[i].type ?? "")) return false;
  }
  return (a.returnType ?? "") === (b.returnType ?? "");
}

/**
 * Diffs the parsed symbols of a single file's base/head content and returns a `SymbolChange` per
 * symbol found on either side.
 */
export function diffFileSymbols(file: FileVersionPair): SymbolChange[] {
  const baseSymbols = file.baseContent ? parseByExtension(file.filePath, file.baseContent) : [];
  const headSymbols = file.headContent ? parseByExtension(file.filePath, file.headContent) : [];
  const baseById = new Map(baseSymbols.map((s) => [s.id, s]));
  const headById = new Map(headSymbols.map((s) => [s.id, s]));
  const allIds = new Set([...baseById.keys(), ...headById.keys()]);

  const changes: SymbolChange[] = [];
  for (const id of allIds) {
    const base = baseById.get(id);
    const head = headById.get(id);
    if (base && !head) {
      changes.push({ symbolId: id, changeType: "removed", base, head: undefined });
    } else if (!base && head) {
      changes.push({ symbolId: id, changeType: "added", base: undefined, head });
    } else if (base && head) {
      const signatureChanged = !signatureEquals(base, head);
      const bodyDelta = bodyLineDeltaRatio(base.bodyText, head.bodyText);
      const changeType = signatureChanged || bodyDelta > 0.3 ? "modified" : "unchanged";
      changes.push({ symbolId: id, changeType, base, head });
    }
  }
  return changes;
}

/** Diffs every file in a changeset and flattens the result into a single list of SymbolChanges. */
export function diffSymbols(files: FileVersionPair[]): SymbolChange[] {
  return files.flatMap(diffFileSymbols);
}

export { bodyLineDeltaRatio, signatureEquals };
