import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { simpleGit } from "simple-git";
import { checkRepo } from "../src/index";
import { MockLLMProvider } from "../src/llm/mockProvider";

async function makeGitRepo(): Promise<string> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "docsync-integration-"));
  const git = simpleGit(dir);
  await git.init();
  await git.addConfig("user.name", "Test User");
  await git.addConfig("user.email", "test@example.com");
  return dir;
}

describe("checkRepo (end-to-end)", () => {
  jest.setTimeout(20000);

  it("detects a high-severity param-count drift and proposes a fix via the mock provider", async () => {
    const repoRoot = await makeGitRepo();
    const git = simpleGit(repoRoot);
    const mathFile = path.join(repoRoot, "math.ts");
    const readmeFile = path.join(repoRoot, "README.md");

    fs.writeFileSync(
      mathFile,
      `/**\n * Adds two numbers together.\n * @param {number} a\n * @param {number} b\n * @returns {number}\n */\nexport function add(a: number, b: number): number {\n  return a + b;\n}\n`
    );
    fs.writeFileSync(
      readmeFile,
      "# Docs\n\n<!-- docsync:ref math.ts#add -->\n## add(a, b)\n\nAdds two numbers together.\n\n**Parameters**\n- `a` (number)\n- `b` (number)\n\n**Returns**: `number`\n"
    );
    await git.add(["math.ts", "README.md"]);
    await git.commit("base: add function");
    const base = (await git.revparse(["HEAD"])).trim();

    fs.writeFileSync(
      mathFile,
      `/**\n * Adds two numbers together.\n * @param {number} a\n * @param {number} b\n * @returns {number}\n */\nexport function add(a: number, b: number, c: number): number {\n  return a + b + c;\n}\n`
    );
    await git.add(["math.ts"]);
    await git.commit("head: add a third parameter");
    const head = (await git.revparse(["HEAD"])).trim();

    const result = await checkRepo({ repoRoot, base, head, llmProvider: new MockLLMProvider() });

    expect(result.changes).toEqual([expect.objectContaining({ symbolId: "math.ts#add", changeType: "modified" })]);
    expect(result.findings.length).toBeGreaterThanOrEqual(2); // docstring + markdown both out of date
    expect(result.findings.every((f) => f.severity === "high")).toBe(true);
    expect(result.blocking).toBe(true); // default blockingSeverity is "medium", high >= medium
    expect(result.usedLLM).toBe(true);
    expect(result.suggestions).toHaveLength(result.findings.length);
    expect(result.suggestions.every((s) => s.source === "llm")).toBe(true);

    fs.rmSync(repoRoot, { recursive: true, force: true });
  });

  it("falls back to detection-only mode with a non-blocking result when there is no drift", async () => {
    const repoRoot = await makeGitRepo();
    const git = simpleGit(repoRoot);
    const mathFile = path.join(repoRoot, "math.ts");

    fs.writeFileSync(mathFile, `export function add(a: number, b: number): number {\n  return a + b;\n}\n`);
    await git.add(["math.ts"]);
    await git.commit("base");
    const base = (await git.revparse(["HEAD"])).trim();

    fs.writeFileSync(mathFile, `export function add(a: number, b: number): number {\n  return a + b; // no behavior change\n}\n`);
    await git.add(["math.ts"]);
    await git.commit("head: comment only");
    const head = (await git.revparse(["HEAD"])).trim();

    const result = await checkRepo({ repoRoot, base, head });

    expect(result.findings).toHaveLength(0);
    expect(result.blocking).toBe(false);
    expect(result.usedLLM).toBe(false);

    fs.rmSync(repoRoot, { recursive: true, force: true });
  });

  it("does not crash when the repo contains a non-OpenAPI YAML file", async () => {
    const repoRoot = await makeGitRepo();
    const git = simpleGit(repoRoot);

    // A plain CI config YAML file — not an OpenAPI document — should be skipped, not crash the scan.
    fs.writeFileSync(path.join(repoRoot, "ci.yaml"), "steps:\n  - run: echo hi\n  bad indentation here\n");
    fs.writeFileSync(path.join(repoRoot, "math.ts"), "export function add(a: number, b: number): number {\n  return a + b;\n}\n");
    await git.add(["ci.yaml", "math.ts"]);
    await git.commit("base");
    const base = (await git.revparse(["HEAD"])).trim();

    fs.writeFileSync(path.join(repoRoot, "math.ts"), "export function add(a: number, b: number, c: number): number {\n  return a + b + c;\n}\n");
    await git.add(["math.ts"]);
    await git.commit("head");
    const head = (await git.revparse(["HEAD"])).trim();

    await expect(checkRepo({ repoRoot, base, head })).resolves.toBeDefined();

    fs.rmSync(repoRoot, { recursive: true, force: true });
  });

  it("degrades gracefully when the Confluence client fails", async () => {
    const repoRoot = await makeGitRepo();
    const git = simpleGit(repoRoot);

    fs.writeFileSync(path.join(repoRoot, "math.ts"), "/**\n * Adds two numbers.\n * @param {number} a\n * @param {number} b\n */\nexport function add(a: number, b: number): number {\n  return a + b;\n}\n");
    await git.add(["math.ts"]);
    await git.commit("base");
    const base = (await git.revparse(["HEAD"])).trim();

    fs.writeFileSync(
      path.join(repoRoot, "docsync.config.json"),
      JSON.stringify({ confluenceLinks: [{ symbolId: "math.ts#add", confluencePageId: "123" }] })
    );
    fs.writeFileSync(path.join(repoRoot, "math.ts"), "/**\n * Adds two numbers.\n * @param {number} a\n * @param {number} b\n */\nexport function add(a: number, b: number, c: number): number {\n  return a + b + c;\n}\n");
    await git.add(["math.ts", "docsync.config.json"]);
    await git.commit("head");
    const head = (await git.revparse(["HEAD"])).trim();

    const failingConfluenceClient = { fetchPage: jest.fn().mockRejectedValue(new Error("Confluence unreachable")) };

    const result = await checkRepo({ repoRoot, base, head, confluenceClient: failingConfluenceClient });

    expect(failingConfluenceClient.fetchPage).toHaveBeenCalledWith("123");
    expect(result.findings.length).toBeGreaterThan(0); // still works via docstring adapter despite Confluence failure

    fs.rmSync(repoRoot, { recursive: true, force: true });
  });
});
