import { DocAdapter, DocModel, ParamModel } from "../types";

const REF_RE = /<!--\s*docsync:ref\s+(\S+)\s*-->/g;
const PARAM_LINE_RE = /^-\s*`([^`]+)`\s*\(([^)]+)\)/gm;
const RETURNS_LINE_RE = /\*\*Returns\*\*:\s*`([^`]+)`/;

/**
 * Parses Markdown sections that follow the `<!-- docsync:ref <symbolId> --> ... **Returns**: ...`
 * convention agreed in the design review (architecture.md §3.2). Each ref comment marks the start
 * of a documented-symbol section that runs until the next ref comment or end of file.
 */
export const MarkdownAdapter: DocAdapter = {
  docType: "markdown",
  parse(content: string, location: string): DocModel[] {
    const models: DocModel[] = [];
    const refMatches = [...content.matchAll(REF_RE)];

    refMatches.forEach((refMatch, index) => {
      const symbolId = refMatch[1];
      const sectionStart = refMatch.index! + refMatch[0].length;
      const sectionEnd = refMatches[index + 1]?.index ?? content.length;
      const section = content.slice(sectionStart, sectionEnd);

      const params: ParamModel[] = [];
      let paramMatch: RegExpExecArray | null;
      PARAM_LINE_RE.lastIndex = 0;
      while ((paramMatch = PARAM_LINE_RE.exec(section)) !== null) {
        params.push({ name: paramMatch[1], type: paramMatch[2] });
      }
      const returnsMatch = RETURNS_LINE_RE.exec(section);
      const descriptionMatch = section.match(/^\s*##[^\n]*\n+([^\n]+)/);

      models.push({
        docType: "markdown",
        location,
        symbolId,
        documentedParams: params,
        documentedReturnType: returnsMatch?.[1],
        description: descriptionMatch?.[1]?.trim(),
        rawContent: section.trim()
      });
    });

    return models;
  },
  render(model: DocModel): string {
    const paramLines = (model.documentedParams ?? []).map((p) => `- \`${p.name}\`${p.type ? ` (${p.type})` : ""}`);
    return [
      `<!-- docsync:ref ${model.symbolId} -->`,
      model.description ?? "",
      "",
      "**Parameters**",
      ...paramLines,
      "",
      model.documentedReturnType ? `**Returns**: \`${model.documentedReturnType}\`` : ""
    ]
      .filter((line) => line !== "")
      .join("\n");
  }
};
