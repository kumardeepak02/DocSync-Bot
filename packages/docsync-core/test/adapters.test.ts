import * as fs from "fs";
import * as path from "path";
import { DocstringAdapter } from "../src/adapters/docstringAdapter";
import { MarkdownAdapter } from "../src/adapters/markdownAdapter";
import { OpenApiAdapter } from "../src/adapters/openApiAdapter";
import { ConfluenceAdapter } from "../src/adapters/confluenceAdapter";

const fixture = (...segments: string[]) => fs.readFileSync(path.join(__dirname, "fixtures", ...segments), "utf-8");

describe("DocstringAdapter", () => {
  it("extracts JSDoc description, @param, and @returns from TypeScript", () => {
    const content = `
/**
 * Adds two numbers together.
 * @param {number} a - the first number
 * @param {number} b - the second number
 * @returns {number}
 */
export function add(a: number, b: number): number {
  return a + b;
}
`;
    const models = DocstringAdapter.parse(content, "src/math.ts");
    expect(models).toHaveLength(1);
    expect(models[0].symbolId).toBe("src/math.ts#add");
    expect(models[0].description).toBe("Adds two numbers together.");
    expect(models[0].documentedParams).toEqual([
      { name: "a", type: "number", optional: false },
      { name: "b", type: "number", optional: false }
    ]);
    expect(models[0].documentedReturnType).toBe("number");
  });

  it("extracts a Sphinx-style Python docstring", () => {
    const content = `def add(a: int, b: int) -> int:\n    """\n    Adds two numbers.\n\n    :param a: first value\n    :param b: second value\n    :rtype: int\n    """\n    return a + b\n`;
    const models = DocstringAdapter.parse(content, "src/math.py");
    expect((models[0].documentedParams ?? []).map((p) => p.name)).toEqual(["a", "b"]);
    expect(models[0].documentedReturnType).toBe("int");
  });
});

describe("MarkdownAdapter", () => {
  it("returns an empty array when there is no docsync:ref section", () => {
    const models = MarkdownAdapter.parse("# Just a plain README\n\nNo special markers here.", "README.md");
    expect(models).toHaveLength(0);
  });

  it("parses a docsync:ref section into a DocModel", () => {
    const content = fixture("markdown", "README.md");
    const models = MarkdownAdapter.parse(content, "README.md");
    expect(models).toHaveLength(1);
    expect(models[0].symbolId).toBe("src/math.ts#add");
    expect(models[0].documentedParams).toEqual([
      { name: "a", type: "number" },
      { name: "b", type: "number" }
    ]);
    expect(models[0].documentedReturnType).toBe("number");
  });

  it("round-trips render() back into a parseable section", () => {
    const content = fixture("markdown", "README.md");
    const [model] = MarkdownAdapter.parse(content, "README.md");
    const rendered = MarkdownAdapter.render(model);
    const reparsed = MarkdownAdapter.parse(rendered, "README.md");
    expect(reparsed[0].documentedParams).toEqual(model.documentedParams);
  });
});

describe("OpenApiAdapter", () => {
  it("skips operations with no x-docsync-ref vendor extension", () => {
    const content = `openapi: 3.0.3\ninfo:\n  title: t\n  version: "1.0.0"\npaths:\n  /health:\n    get:\n      summary: liveness check\n`;
    const models = OpenApiAdapter.parse(content, "unrelated.yaml");
    expect(models).toHaveLength(0);
  });

  it("parses an operation carrying x-docsync-ref", () => {
    const content = fixture("openapi", "sample.yaml");
    const models = OpenApiAdapter.parse(content, "sample.yaml");
    expect(models).toHaveLength(1);
    expect(models[0].symbolId).toBe("src/users.ts#getUserById");
    expect(models[0].documentedParams).toEqual([{ name: "id", type: "string", optional: false }]);
  });
});

describe("ConfluenceAdapter", () => {
  it("returns an empty params list when the page body has no parameter bullets", () => {
    const content = JSON.stringify({
      id: "999",
      title: "Empty page",
      body: { storage: { value: "<p>Just a description, no params.</p>" } }
    });
    const models = ConfluenceAdapter.parse(content, "page-999.json");
    expect(models[0].documentedParams).toEqual([]);
    expect(models[0].documentedReturnType).toBeUndefined();
  });

  it("parses a page export without resolving symbolId", () => {
    const content = fixture("confluence", "page-123456.json");
    const models = ConfluenceAdapter.parse(content, "page-123456.json");
    expect(models).toHaveLength(1);
    expect(models[0].symbolId).toBeUndefined();
    expect(models[0].location).toBe("123456");
    expect(models[0].documentedParams).toEqual([
      { name: "a", type: "number" },
      { name: "b", type: "number" }
    ]);
  });
});

