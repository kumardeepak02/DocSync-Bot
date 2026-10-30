import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { simpleGit } from "simple-git";
import { runCli } from "../src/cli";

async function makeGitRepo(): Promise<string> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "docsync-cli-"));
  const git = simpleGit(dir);
  await git.init();
  await git.addConfig("user.name", "Test User");
  await git.addConfig("user.email", "test@example.com");
  return dir;
}

describe("runCli", () => {
  jest.setTimeout(20000);

  it("exits 0 and reports a clean pass when there is no drift", async () => {
    const repoRoot = await makeGitRepo();
    const git = simpleGit(repoRoot);
    fs.writeFileSync(path.join(repoRoot, "math.ts"), "export function add(a: number, b: number): number {\n  return a + b;\n}\n");
    await git.add(["math.ts"]);
    await git.commit("base");
    const base = (await git.revparse(["HEAD"])).trim();
    fs.writeFileSync(path.join(repoRoot, "math.ts"), "export function add(a: number, b: number): number {\n  return a + b; // noop comment\n}\n");
    await git.add(["math.ts"]);
    await git.commit("head");
    const head = (await git.revparse(["HEAD"])).trim();

    const stdout: string[] = [];
    const exitCode = await runCli(["node", "docsync-cli", "check", "--base", base, "--head", head, "--repo", repoRoot], {
      stdout: (msg) => stdout.push(msg),
      stderr: () => {}
    });

    expect(exitCode).toBe(0);
    expect(stdout.join("\n")).toContain("no documentation drift detected");

    fs.rmSync(repoRoot, { recursive: true, force: true });
  });

  it("exits 1 when blocking drift is detected", async () => {
    const repoRoot = await makeGitRepo();
    const git = simpleGit(repoRoot);
    const file = path.join(repoRoot, "math.ts");
    const readme = path.join(repoRoot, "README.md");

    fs.writeFileSync(file, "/**\n * Adds two numbers.\n * @param {number} a\n * @param {number} b\n */\nexport function add(a: number, b: number): number {\n  return a + b;\n}\n");
    fs.writeFileSync(readme, "<!-- docsync:ref math.ts#add -->\n## add(a, b)\nAdds two numbers.\n\n**Parameters**\n- `a` (number)\n- `b` (number)\n");
    await git.add(["math.ts", "README.md"]);
    await git.commit("base");
    const base = (await git.revparse(["HEAD"])).trim();

    fs.writeFileSync(file, "/**\n * Adds two numbers.\n * @param {number} a\n * @param {number} b\n */\nexport function add(a: number, b: number, c: number): number {\n  return a + b + c;\n}\n");
    await git.add(["math.ts"]);
    await git.commit("head");
    const head = (await git.revparse(["HEAD"])).trim();

    const stdout: string[] = [];
    const exitCode = await runCli(["node", "docsync-cli", "check", "--base", base, "--head", head, "--repo", repoRoot], {
      stdout: (msg) => stdout.push(msg),
      stderr: () => {}
    });

    expect(exitCode).toBe(1);
    expect(stdout.join("\n")).toContain("blocking");

    fs.rmSync(repoRoot, { recursive: true, force: true });
  });

  it("exits 2 and reports an error for a non-existent repo", async () => {
    const stderr: string[] = [];
    const exitCode = await runCli(
      ["node", "docsync-cli", "check", "--base", "HEAD~1", "--head", "HEAD", "--repo", "C:/does/not/exist"],
      { stdout: () => {}, stderr: (msg) => stderr.push(msg) }
    );
    expect(exitCode).toBe(2);
    expect(stderr.join("\n")).toContain("DocSync-Bot check failed");
  });
});
