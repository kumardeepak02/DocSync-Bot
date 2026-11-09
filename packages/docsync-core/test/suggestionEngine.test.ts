import { buildPrompt, generateSuggestions } from "../src/suggestion/suggestionEngine";
import { validateSuggestion } from "../src/suggestion/validator";
import { DriftFinding, LLMProvider, SymbolChange, SymbolModel } from "../src/types";

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

function makeFinding(overrides: Partial<DriftFinding> = {}): DriftFinding {
  const change: SymbolChange = {
    symbolId: "src/math.ts#add",
    changeType: "modified",
    base: makeSymbol(),
    head: makeSymbol()
  };
  return {
    symbolId: "src/math.ts#add",
    docType: "docstring",
    severity: "high",
    reason: "Documented parameters no longer match.",
    change,
    doc: { docType: "docstring", location: "src/math.ts#add", symbolId: "src/math.ts#add", rawContent: "/** old docs */" },
    ...overrides
  };
}

describe("validateSuggestion", () => {
  it("passes when only real parameters/symbol names are referenced", () => {
    const warnings = validateSuggestion("Adds `a` and `b` and returns the sum. See `add`.", ["a", "b"], "add");
    expect(warnings).toHaveLength(0);
  });

  it("flags a backtick-quoted identifier that isn't a real parameter", () => {
    const warnings = validateSuggestion("Adds `a` and `c` together.", ["a", "b"], "add");
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/`c`/);
  });
});

describe("buildPrompt", () => {
  it("includes the drift reason, signature, and existing doc content", () => {
    const prompt = buildPrompt(makeFinding());
    expect(prompt).toContain("Drift reason: Documented parameters no longer match.");
    expect(prompt).toContain("Current signature: add(a: number, b: number): number");
    expect(prompt).toContain("/** old docs */");
  });

  it("redacts secrets embedded in the existing doc content", () => {
    const finding = makeFinding({
      doc: {
        docType: "docstring",
        location: "src/math.ts#add",
        rawContent: 'const apiKey = "sk-abcdef1234567890";'
      }
    });
    const prompt = buildPrompt(finding);
    expect(prompt).not.toContain("sk-abcdef1234567890");
    expect(prompt).toContain("[REDACTED:generic-api-key-assignment]");
  });
});

describe("generateSuggestions", () => {
  it("produces a detection-only suggestion when no provider is configured", async () => {
    const suggestions = await generateSuggestions([makeFinding()], undefined);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].source).toBe("detection-only");
    expect(suggestions[0].proposedContent).toBeUndefined();
  });

  it("calls the provider and validates its output when a provider is configured", async () => {
    const provider: LLMProvider = { name: "stub", generate: jest.fn().mockResolvedValue("Adds `a` and `b`.") };
    const suggestions = await generateSuggestions([makeFinding()], provider);
    expect(provider.generate).toHaveBeenCalledTimes(1);
    expect(suggestions[0].source).toBe("llm");
    expect(suggestions[0].proposedContent).toBe("Adds `a` and `b`.");
    expect(suggestions[0].validationWarnings).toHaveLength(0);
  });

  it("surfaces validation warnings for hallucinated identifiers", async () => {
    const provider: LLMProvider = { name: "stub", generate: jest.fn().mockResolvedValue("Adds `a` and `z`.") };
    const suggestions = await generateSuggestions([makeFinding()], provider);
    expect(suggestions[0].validationWarnings).toHaveLength(1);
  });
});
