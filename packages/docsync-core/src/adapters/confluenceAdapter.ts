import { DocAdapter, DocModel, ParamModel } from "../types";

interface ConfluencePage {
  id: string;
  title: string;
  body: { storage: { value: string } };
}

const LI_PARAM_RE = /<li>([^<(]+?)\s*\(([^)]+)\)<\/li>/g;
const FIRST_P_RE = /<p>(.*?)<\/p>/;
const RETURNS_RE = /Returns:\s*([^<]+)/;

/**
 * Parses a Confluence page export (JSON with a `body.storage.value` HTML fragment, matching the
 * Confluence REST API v2 page shape). Unlike the other adapters, Confluence pages cannot carry an
 * inline `docsync:ref`-style tag, so `symbolId` is left unset here — it is filled in afterwards by
 * `LinkResolver` from the explicit `docsync.config.json` `confluenceLinks` mapping (design review,
 * Finding 4).
 */
export const ConfluenceAdapter: DocAdapter = {
  docType: "confluence",
  parse(content: string, location: string): DocModel[] {
    const page = JSON.parse(content) as ConfluencePage;
    const html = page.body.storage.value;

    const params: ParamModel[] = [];
    let match: RegExpExecArray | null;
    LI_PARAM_RE.lastIndex = 0;
    while ((match = LI_PARAM_RE.exec(html)) !== null) {
      params.push({ name: match[1].trim(), type: match[2].trim() });
    }

    return [
      {
        docType: "confluence",
        location: page.id ?? location,
        symbolId: undefined,
        documentedParams: params,
        documentedReturnType: RETURNS_RE.exec(html)?.[1]?.trim(),
        description: FIRST_P_RE.exec(html)?.[1]?.trim(),
        rawContent: html
      }
    ];
  },
  render(model: DocModel): string {
    const paramItems = (model.documentedParams ?? [])
      .map((p) => `<li>${p.name}${p.type ? ` (${p.type})` : ""}</li>`)
      .join("");
    return [
      `<p>${model.description ?? ""}</p>`,
      `<ul>${paramItems}</ul>`,
      model.documentedReturnType ? `<p>Returns: ${model.documentedReturnType}</p>` : ""
    ]
      .filter(Boolean)
      .join("");
  }
};
