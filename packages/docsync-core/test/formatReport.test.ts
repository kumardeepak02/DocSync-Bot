import { formatReport } from "../src/report/formatReport";
import { CheckResult, DEFAULT_CONFIG } from "../src/types";

function makeResult(overrides: Partial<CheckResult> = {}): CheckResult {
  return {
    config: DEFAULT_CONFIG,
    changes: [],
    findings: [],
    suggestions: [],
    usedLLM: false,
    blocking: false,
    ...overrides
  };
}

describe("formatReport", () => {
  it("reports a clean pass when there are no findings", () => {
    const report = formatReport(makeResult());
    expect(report).toContain("no documentation drift detected");
  });

  it("renders a findings table and suggestion diff blocks", () => {
    const result = makeResult({
      usedLLM: true,
      blocking: true,
      findings: [
        {
          symbolId: "src/math.ts#add",
          docType: "docstring",
          severity: "high",
          reason: "Documented parameters no longer match the code.",
          change: { symbolId: "src/math.ts#add", changeType: "modified" }
        }
      ],
      suggestions: [
        {
          finding: {
            symbolId: "src/math.ts#add",
            docType: "docstring",
            severity: "high",
            reason: "Documented parameters no longer match the code.",
            change: { symbolId: "src/math.ts#add", changeType: "modified" }
          },
          before: "/** old docs */",
          after: "/** new docs */",
          proposedContent: "/** new docs */",
          source: "llm",
          validationWarnings: ["references `z`, which is not a real parameter"]
        }
      ]
    });

    const report = formatReport(result);
    expect(report).toContain("🔴 HIGH");
    expect(report).toContain("`src/math.ts#add`");
    expect(report).toContain("- /** old docs */");
    expect(report).toContain("+ /** new docs */");
    expect(report).toContain("⚠️ **Validation warnings:**");
    expect(report).toContain("❌ blocking");
  });

  it("marks suggestions as detection-only when there is no LLM provider", () => {
    const result = makeResult({
      findings: [
        {
          symbolId: "src/math.ts#add",
          docType: "docstring",
          severity: "medium",
          reason: "Undocumented new symbol.",
          change: { symbolId: "src/math.ts#add", changeType: "added" }
        }
      ],
      suggestions: [
        {
          finding: {
            symbolId: "src/math.ts#add",
            docType: "docstring",
            severity: "medium",
            reason: "Undocumented new symbol.",
            change: { symbolId: "src/math.ts#add", changeType: "added" }
          },
          before: "",
          source: "detection-only",
          validationWarnings: []
        }
      ]
    });

    const report = formatReport(result);
    expect(report).toContain("No LLM provider configured: showing detection-only results");
    expect(report).toContain("No LLM provider configured — drift detected but no suggestion generated.");
  });
});
