import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { loadConfig } from "../src/link/config";
import { groupDocsBySymbol, resolveLinks } from "../src/link/linkResolver";
import { DEFAULT_CONFIG, DocModel } from "../src/types";

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "docsync-config-"));
}

describe("loadConfig", () => {
  it("returns defaults when docsync.config.json is absent", () => {
    const dir = makeTempDir();
    expect(loadConfig(dir)).toEqual(DEFAULT_CONFIG);
  });

  it("merges a partial config file over the defaults", () => {
    const dir = makeTempDir();
    fs.writeFileSync(path.join(dir, "docsync.config.json"), JSON.stringify({ blockingSeverity: "high" }));
    const config = loadConfig(dir);
    expect(config.blockingSeverity).toBe("high");
    expect(config.enabledAdapters).toEqual(DEFAULT_CONFIG.enabledAdapters);
  });

  it("falls back to defaults when the config file is malformed JSON", () => {
    const dir = makeTempDir();
    fs.writeFileSync(path.join(dir, "docsync.config.json"), "{ not valid json");
    expect(loadConfig(dir)).toEqual(DEFAULT_CONFIG);
  });
});

describe("resolveLinks", () => {
  const baseDoc: DocModel = {
    docType: "confluence",
    location: "123456",
    rawContent: "<p>x</p>"
  };

  it("fills in symbolId for Confluence docs from the config mapping", () => {
    const docs = resolveLinks([baseDoc], {
      ...DEFAULT_CONFIG,
      confluenceLinks: [{ confluencePageId: "123456", symbolId: "src/math.ts#add" }]
    });
    expect(docs[0].symbolId).toBe("src/math.ts#add");
  });

  it("leaves symbolId unresolved when no mapping entry matches", () => {
    const docs = resolveLinks([baseDoc], DEFAULT_CONFIG);
    expect(docs[0].symbolId).toBeUndefined();
  });

  it("filters out docs whose adapter is disabled", () => {
    const docs = resolveLinks([baseDoc], { ...DEFAULT_CONFIG, enabledAdapters: ["markdown"] });
    expect(docs).toHaveLength(0);
  });
});

describe("groupDocsBySymbol", () => {
  it("drops docs that never resolved to a symbolId", () => {
    const docs: DocModel[] = [
      { docType: "markdown", location: "README.md", symbolId: "a#x", rawContent: "" },
      { docType: "confluence", location: "999", rawContent: "" }
    ];
    const grouped = groupDocsBySymbol(docs);
    expect(grouped.size).toBe(1);
    expect(grouped.get("a#x")).toHaveLength(1);
  });
});
