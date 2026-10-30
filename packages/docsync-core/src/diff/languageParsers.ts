import { Project, SourceFile, JSDocableNode, FunctionDeclaration, MethodDeclaration } from "ts-morph";
import { ParamModel, SymbolModel } from "../types";

function extractParams(node: FunctionDeclaration | MethodDeclaration): ParamModel[] {
  return node.getParameters().map((p) => ({
    name: p.getName(),
    type: p.getTypeNode()?.getText(),
    optional: p.isOptional() || p.hasInitializer()
  }));
}

function extractDocComment(node: JSDocableNode): string | undefined {
  const docs = node.getJsDocs();
  if (docs.length === 0) return undefined;
  return docs[docs.length - 1].getDescription().trim() || undefined;
}

/**
 * Walks every top-level function and class method in a source file, invoking `callback` with a
 * stable `id` (`<filePath>#<name>` or `<filePath>#<Class>.<method>`) and the ts-morph node.
 * Shared by `parseTypeScript` (code-signature extraction) and `docstringAdapter`
 * (JSDoc-as-currently-written extraction) so the two don't maintain duplicate traversal logic.
 */
export function forEachTsFunctionLike(
  sourceFile: SourceFile,
  callback: (id: string, name: string, node: FunctionDeclaration | MethodDeclaration) => void
): void {
  for (const fn of sourceFile.getFunctions()) {
    const name = fn.getName();
    if (!name) continue;
    callback(`${sourceFile.getFilePath()}#${name}`, name, fn);
  }

  for (const cls of sourceFile.getClasses()) {
    const className = cls.getName() ?? "(anonymous)";
    for (const method of cls.getMethods()) {
      const name = `${className}.${method.getName()}`;
      callback(`${sourceFile.getFilePath()}#${name}`, name, method);
    }
  }
}

/**
 * Parses a single TypeScript/JavaScript file's content into a list of exported top-level
 * functions and class methods. Intentionally scoped to the common cases needed for docstring
 * drift detection (full language coverage is a documented known limitation).
 */
export function parseTypeScript(content: string, filePath: string): SymbolModel[] {
  const project = new Project({ useInMemoryFileSystem: true });
  const sourceFile: SourceFile = project.createSourceFile(filePath, content, { overwrite: true });
  const symbols: SymbolModel[] = [];

  forEachTsFunctionLike(sourceFile, (id, name, node) => {
    symbols.push({
      id: `${filePath}#${name}`,
      name,
      filePath,
      kind: name.includes(".") ? "method" : "function",
      params: extractParams(node),
      returnType: node.getReturnTypeNode()?.getText(),
      bodyText: node.getBodyText() ?? "",
      docComment: extractDocComment(node)
    });
  });

  return symbols;
}

const PY_DEF_RE = /^(?:async\s+)?def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*(?:->\s*([^\s:]+))?\s*:/gm;

/**
 * Regex-based extraction of Python top-level function signatures (known MVP limitation vs. a
 * full AST parser — see architecture.md §8).
 */
export function parsePython(content: string, filePath: string): SymbolModel[] {
  const symbols: SymbolModel[] = [];
  const lines = content.split(/\r?\n/);
  let match: RegExpExecArray | null;
  PY_DEF_RE.lastIndex = 0;

  while ((match = PY_DEF_RE.exec(content)) !== null) {
    const [, name, rawParams, returnType] = match;
    const params: ParamModel[] = rawParams
      .split(",")
      .map((p) => p.trim())
      .filter((p) => p.length > 0 && p !== "self")
      .map((p) => {
        const [nameAndType, defaultValue] = p.split("=");
        const [paramName, paramType] = nameAndType.split(":").map((s) => s.trim());
        return {
          name: paramName,
          type: paramType || undefined,
          optional: defaultValue !== undefined
        };
      });

    const startLine = content.slice(0, match.index).split(/\r?\n/).length - 1;
    const docComment = extractPythonDocstring(lines, startLine);
    const bodyText = extractPythonBody(lines, startLine);

    symbols.push({
      id: `${filePath}#${name}`,
      name,
      filePath,
      kind: "function",
      params,
      returnType: returnType?.trim(),
      bodyText,
      docComment
    });
  }

  return symbols;
}

function extractPythonDocstring(lines: string[], defLineIndex: number): string | undefined {
  const next = lines[defLineIndex + 1]?.trim();
  if (!next || !(next.startsWith('"""') || next.startsWith("'''"))) return undefined;
  const quote = next.slice(0, 3);
  if (next.length > 3 && next.endsWith(quote) && next !== quote) {
    return next.slice(3, -3).trim();
  }
  const collected: string[] = [next.slice(3)];
  for (let i = defLineIndex + 2; i < lines.length; i++) {
    if (lines[i].includes(quote)) {
      collected.push(lines[i].slice(0, lines[i].indexOf(quote)));
      break;
    }
    collected.push(lines[i]);
  }
  return collected.join("\n").trim();
}

function extractPythonBody(lines: string[], defLineIndex: number): string {
  const bodyLines: string[] = [];
  const baseIndent = (lines[defLineIndex].match(/^\s*/) ?? [""])[0].length;
  for (let i = defLineIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "") {
      bodyLines.push(line);
      continue;
    }
    const indent = (line.match(/^\s*/) ?? [""])[0].length;
    if (indent <= baseIndent) break;
    bodyLines.push(line);
  }
  return bodyLines.join("\n");
}
