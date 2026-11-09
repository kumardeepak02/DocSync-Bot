import { Project } from "ts-morph";
import { forEachTsFunctionLike } from "../diff/languageParsers";
import { DocAdapter, DocModel, ParamModel } from "../types";

const JS_PARAM_TAG_RE = /@param\s+(?:\{([^}]+)\}\s*)?(\S+)(?:\s+-?\s*(.*))?/g;
const JS_RETURNS_TAG_RE = /@returns?\s+(?:\{([^}]+)\})?/;
const PY_PARAM_TAG_RE = /:param\s+(\S+?):\s*(.*)/g;
const PY_RTYPE_TAG_RE = /:rtype:\s*(.*)/;

function parseJsDocParams(fullDocText: string): ParamModel[] {
  const params: ParamModel[] = [];
  let match: RegExpExecArray | null;
  JS_PARAM_TAG_RE.lastIndex = 0;
  while ((match = JS_PARAM_TAG_RE.exec(fullDocText)) !== null) {
    const [, type, name] = match;
    params.push({ name: name.replace(/[[\]]/g, ""), type, optional: name.startsWith("[") });
  }
  return params;
}

/**
 * Builds DocModel entries from the JSDoc comments already attached to TypeScript/JavaScript
 * functions and class methods. This is the "documentation as currently written" view, as opposed
 * to `languageParsers.ts` which extracts the actual code signature for diffing. Reuses
 * `forEachTsFunctionLike` so the function/method traversal logic lives in exactly one place.
 */
function parseTsDocModels(content: string, filePath: string): DocModel[] {
  const project = new Project({ useInMemoryFileSystem: true });
  const sourceFile = project.createSourceFile(filePath, content, { overwrite: true });
  const models: DocModel[] = [];

  forEachTsFunctionLike(sourceFile, (id, name, node) => {
    const docs = node.getJsDocs();
    if (docs.length === 0) return;
    const lastDoc = docs[docs.length - 1];
    const fullText = lastDoc.getFullText();
    const returnsMatch = JS_RETURNS_TAG_RE.exec(fullText);
    models.push({
      docType: "docstring",
      location: `${filePath}#${name}`,
      symbolId: `${filePath}#${name}`,
      documentedParams: parseJsDocParams(fullText),
      documentedReturnType: returnsMatch?.[1],
      description: lastDoc.getDescription().trim() || undefined,
      rawContent: fullText
    });
  });

  return models;
}

function parsePyDocModels(content: string, filePath: string): DocModel[] {
  const models: DocModel[] = [];
  const defRe = /^(?:async\s+)?def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\([^)]*\)\s*(?:->\s*[^\s:]+)?\s*:\s*\n\s*("""|''')([\s\S]*?)\2/gm;
  let match: RegExpExecArray | null;
  while ((match = defRe.exec(content)) !== null) {
    const [, name, , docBody] = match;
    const params: ParamModel[] = [];
    let paramMatch: RegExpExecArray | null;
    PY_PARAM_TAG_RE.lastIndex = 0;
    while ((paramMatch = PY_PARAM_TAG_RE.exec(docBody)) !== null) {
      params.push({ name: paramMatch[1] });
    }
    const rtypeMatch = PY_RTYPE_TAG_RE.exec(docBody);
    const description = docBody.split(/:param|:return|:rtype/)[0].trim() || undefined;
    models.push({
      docType: "docstring",
      location: `${filePath}#${name}`,
      symbolId: `${filePath}#${name}`,
      documentedParams: params,
      documentedReturnType: rtypeMatch?.[1]?.trim(),
      description,
      rawContent: docBody.trim()
    });
  }
  return models;
}

export const DocstringAdapter: DocAdapter = {
  docType: "docstring",
  parse(content: string, location: string): DocModel[] {
    if (/\.py$/.test(location)) return parsePyDocModels(content, location);
    return parseTsDocModels(content, location);
  },
  render(model: DocModel): string {
    const paramLines = (model.documentedParams ?? []).map((p) => ` * @param ${p.type ? `{${p.type}} ` : ""}${p.name}`);
    const returnLine = model.documentedReturnType ? ` * @returns {${model.documentedReturnType}}` : undefined;
    return [
      "/**",
      ` * ${model.description ?? ""}`,
      ...paramLines,
      ...(returnLine ? [returnLine] : []),
      " */"
    ].join("\n");
  }
};
