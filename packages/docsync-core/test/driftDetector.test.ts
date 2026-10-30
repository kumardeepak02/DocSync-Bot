import { detectDrift } from "../src/drift/driftDetector";
import { DocModel, SymbolChange, SymbolModel } from "../src/types";

function makeSymbol(overrides: Partial<SymbolModel> = {}): SymbolModel {
  return {
    id: "src/math.ts#add",
    name: "add",
    filePath: "src/math.ts",
    kind: "function",
    params: [{ name: "a", type: "number" }, { name: "b", type: "number" }],
    returnType: "number",
    bodyText: "return a + b;",
    ...overrides
  };
}

function makeDoc(overrides: Partial<DocModel> = {}): DocModel {
  return {
    docType: "docstring",
    location: "src/math.ts#add",
    symbolId: "src/math.ts#add",
    documentedParams: [{ name: "a", type: "number" }, { name: "b", type: "number" }],
    documentedReturnType: "number",
    rawContent: "",
    ...overrides
  };
}

describe("detectDrift", () => {
  it("flags high severity when documented params no longer match the code", () => {
    const change: SymbolChange = {
      symbolId: "src/math.ts#add",
      changeType: "modified",
      base: makeSymbol(),
      head: makeSymbol({ params: [{ name: "a", type: "number" }, { name: "b", type: "number" }, { name: "c", type: "number" }] })
    };
    const findings = detectDrift([change], new Map([["src/math.ts#add", [makeDoc()]]]));
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe("high");
    expect(findings[0].reason).toMatch(/no longer match the code's parameters/);
  });

  it("does not flag param drift when the doc never itemized params (prose-only JSDoc) — regression from dogfooding", () => {
    const change: SymbolChange = {
      symbolId: "src/math.ts#add",
      changeType: "modified",
      base: makeSymbol(),
      head: makeSymbol({ params: [{ name: "a", type: "number" }, { name: "b", type: "number" }, { name: "c", type: "number" }] })
    };
    const docWithNoItemizedParams = makeDoc({ documentedParams: [], documentedReturnType: undefined });
    const findings = detectDrift([change], new Map([["src/math.ts#add", [docWithNoItemizedParams]]]));
    expect(findings).toHaveLength(0);
  });

  it("flags high severity when the documented return type no longer matches", () => {
    const change: SymbolChange = {
      symbolId: "src/math.ts#add",
      changeType: "modified",
      base: makeSymbol(),
      head: makeSymbol({ returnType: "string" })
    };
    const findings = detectDrift([change], new Map([["src/math.ts#add", [makeDoc()]]]));
    expect(findings[0].severity).toBe("high");
    expect(findings[0].reason).toMatch(/return type/);
  });

  it("flags medium severity for a new symbol with no linked documentation", () => {
    const change: SymbolChange = { symbolId: "src/math.ts#subtract", changeType: "added", head: makeSymbol({ id: "src/math.ts#subtract", name: "subtract" }) };
    const findings = detectDrift([change], new Map());
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe("medium");
  });

  it("flags low severity when the signature is stable but the body changed significantly", () => {
    const base = makeSymbol({ bodyText: "return a + b;" });
    const head = makeSymbol({ bodyText: "const sum = a + b;\nconsole.log('adding', a, b);\nreturn sum;" });
    const change: SymbolChange = { symbolId: "src/math.ts#add", changeType: "modified", base, head };
    const findings = detectDrift([change], new Map([["src/math.ts#add", [makeDoc()]]]));
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe("low");
  });

  it("produces no findings for an unchanged symbol", () => {
    const symbol = makeSymbol();
    const change: SymbolChange = { symbolId: "src/math.ts#add", changeType: "unchanged", base: symbol, head: symbol };
    const findings = detectDrift([change], new Map([["src/math.ts#add", [makeDoc()]]]));
    expect(findings).toHaveLength(0);
  });

  it("produces no findings for a removed symbol", () => {
    const change: SymbolChange = { symbolId: "src/math.ts#add", changeType: "removed", base: makeSymbol() };
    const findings = detectDrift([change], new Map([["src/math.ts#add", [makeDoc()]]]));
    expect(findings).toHaveLength(0);
  });

  it("produces no findings for a modified symbol with no linked docs", () => {
    const change: SymbolChange = {
      symbolId: "src/math.ts#add",
      changeType: "modified",
      base: makeSymbol(),
      head: makeSymbol({ returnType: "string" })
    };
    const findings = detectDrift([change], new Map());
    expect(findings).toHaveLength(0);
  });

  it("emits one finding per linked doc type when multiple docs describe the same symbol", () => {
    const change: SymbolChange = {
      symbolId: "src/math.ts#add",
      changeType: "modified",
      base: makeSymbol(),
      head: makeSymbol({ returnType: "string" })
    };
    const docs = [makeDoc({ docType: "docstring" }), makeDoc({ docType: "markdown", location: "README.md" })];
    const findings = detectDrift([change], new Map([["src/math.ts#add", docs]]));
    expect(findings).toHaveLength(2);
    expect(findings.map((f) => f.docType).sort()).toEqual(["docstring", "markdown"]);
  });
});
