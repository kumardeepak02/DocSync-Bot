import { diffFileSymbols, diffSymbols } from "../src/diff/diffAnalyzer";
import { parsePython, parseTypeScript } from "../src/diff/languageParsers";

describe("parseTypeScript", () => {
  it("extracts function signature, return type, and JSDoc", () => {
    const content = `
/**
 * Adds two numbers together.
 */
export function add(a: number, b: number): number {
  return a + b;
}
`;
    const symbols = parseTypeScript(content, "src/math.ts");
    expect(symbols).toHaveLength(1);
    expect(symbols[0]).toMatchObject({
      id: "src/math.ts#add",
      name: "add",
      returnType: "number",
      docComment: "Adds two numbers together."
    });
    expect(symbols[0].params).toEqual([
      { name: "a", type: "number", optional: false },
      { name: "b", type: "number", optional: false }
    ]);
  });

  it("extracts class methods with a composite id", () => {
    const content = `
export class Calculator {
  multiply(a: number, b: number): number {
    return a * b;
  }
}
`;
    const symbols = parseTypeScript(content, "src/calc.ts");
    expect(symbols[0].id).toBe("src/calc.ts#Calculator.multiply");
  });
});

describe("parsePython", () => {
  it("extracts a function signature and docstring", () => {
    const content = `def add(a: int, b: int) -> int:\n    """Adds two numbers."""\n    return a + b\n`;
    const symbols = parsePython(content, "src/math.py");
    expect(symbols).toHaveLength(1);
    expect(symbols[0]).toMatchObject({
      id: "src/math.py#add",
      name: "add",
      returnType: "int",
      docComment: "Adds two numbers."
    });
    expect(symbols[0].params).toEqual([
      { name: "a", type: "int", optional: false },
      { name: "b", type: "int", optional: false }
    ]);
  });

  it("ignores 'self' in method parameter lists", () => {
    const content = `def greet(self, name: str) -> str:\n    return f"hi {name}"\n`;
    const symbols = parsePython(content, "src/greeter.py");
    expect(symbols[0].params).toEqual([{ name: "name", type: "str", optional: false }]);
  });

  it("matches 'async def' functions (regression: previously only matched plain 'def')", () => {
    const content = `async def fetch(url: str) -> str:\n    return await get(url)\n`;
    const symbols = parsePython(content, "src/fetcher.py");
    expect(symbols).toHaveLength(1);
    expect(symbols[0]).toMatchObject({ id: "src/fetcher.py#fetch", name: "fetch", returnType: "str" });
  });
});

describe("diffFileSymbols", () => {
  const baseContent = `export function add(a: number, b: number): number {\n  return a + b;\n}\n`;

  it("flags added symbols with no base counterpart", () => {
    const changes = diffFileSymbols({ filePath: "src/math.ts", baseContent: undefined, headContent: baseContent });
    expect(changes).toEqual([
      expect.objectContaining({ symbolId: "src/math.ts#add", changeType: "added" })
    ]);
  });

  it("flags removed symbols with no head counterpart", () => {
    const changes = diffFileSymbols({ filePath: "src/math.ts", baseContent: baseContent, headContent: undefined });
    expect(changes).toEqual([
      expect.objectContaining({ symbolId: "src/math.ts#add", changeType: "removed" })
    ]);
  });

  it("flags a modified signature when a parameter is added", () => {
    const headContent = `export function add(a: number, b: number, c: number): number {\n  return a + b + c;\n}\n`;
    const changes = diffFileSymbols({ filePath: "src/math.ts", baseContent, headContent });
    expect(changes[0].changeType).toBe("modified");
  });

  it("marks a symbol unchanged when signature and body are stable", () => {
    const changes = diffFileSymbols({ filePath: "src/math.ts", baseContent, headContent: baseContent });
    expect(changes[0].changeType).toBe("unchanged");
  });

  it("flags modified when body changes significantly even with the same signature", () => {
    const headContent = `export function add(a: number, b: number): number {\n  const sum = a + b;\n  console.log(sum);\n  return sum;\n}\n`;
    const changes = diffFileSymbols({ filePath: "src/math.ts", baseContent, headContent });
    expect(changes[0].changeType).toBe("modified");
  });
});

describe("diffSymbols", () => {
  it("flattens changes across multiple files", () => {
    const changes = diffSymbols([
      { filePath: "a.ts", baseContent: undefined, headContent: "export function a() {}\n" },
      { filePath: "b.ts", baseContent: undefined, headContent: "export function b() {}\n" }
    ]);
    expect(changes).toHaveLength(2);
  });
});

