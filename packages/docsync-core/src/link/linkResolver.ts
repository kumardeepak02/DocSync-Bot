import { DocModel, DocSyncConfig } from "../types";

/**
 * Resolves a batch of parsed `DocModel`s against the project config: disables adapters the user
 * excluded, and fills in `symbolId` for doc types (Confluence) that can't self-link via an inline
 * tag, using the explicit `confluenceLinks` mapping (design review, Finding 4).
 */
export function resolveLinks(docs: DocModel[], config: DocSyncConfig): DocModel[] {
  const enabled = new Set(config.enabledAdapters);
  const confluenceLinkByPageId = new Map(config.confluenceLinks.map((l) => [l.confluencePageId, l.symbolId]));

  return docs
    .filter((doc) => enabled.has(doc.docType))
    .map((doc) => {
      if (doc.docType === "confluence" && !doc.symbolId) {
        const symbolId = confluenceLinkByPageId.get(doc.location);
        return symbolId ? { ...doc, symbolId } : doc;
      }
      return doc;
    });
}

/** Groups resolved docs by the symbol they document, dropping any that never resolved to a symbol. */
export function groupDocsBySymbol(docs: DocModel[]): Map<string, DocModel[]> {
  const map = new Map<string, DocModel[]>();
  for (const doc of docs) {
    if (!doc.symbolId) continue;
    const list = map.get(doc.symbolId) ?? [];
    list.push(doc);
    map.set(doc.symbolId, list);
  }
  return map;
}
