import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { simpleGit } from "simple-git";
import { GitDiffSource } from "../src/diff/gitSource";

async function makeGitRepo(): Promise<string> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "docsync-gitsource-"));
  const git = simpleGit(dir);
  await git.init();
  await git.addConfig("user.name", "Test User");
  await git.addConfig("user.email", "test@example.com");
  return dir;
}

describe("GitDiffSource", () => {
  jest.setTimeout(20000);

  it("reports undefined baseContent for a newly added file", async () => {
    const repoRoot = await makeGitRepo();
    const git = simpleGit(repoRoot);
    fs.writeFileSync(path.join(repoRoot, "existing.ts"), "export const x = 1;\n");
    await git.add(["existing.ts"]);
    await git.commit("base");
    const base = (await git.revparse(["HEAD"])).trim();

    fs.writeFileSync(path.join(repoRoot, "new-file.ts"), "export const y = 2;\n");
    await git.add(["new-file.ts"]);
    await git.commit("head: add new-file.ts");
    const head = (await git.revparse(["HEAD"])).trim();

    const pairs = await new GitDiffSource(repoRoot).getChangedFiles(base, head);
    expect(pairs).toEqual([{ filePath: "new-file.ts", baseContent: undefined, headContent: "export const y = 2;\n" }]);

    fs.rmSync(repoRoot, { recursive: true, force: true });
  });

  it("reports undefined headContent for a removed file", async () => {
    const repoRoot = await makeGitRepo();
    const git = simpleGit(repoRoot);
    const removedPath = path.join(repoRoot, "to-remove.ts");
    fs.writeFileSync(removedPath, "export const z = 3;\n");
    await git.add(["to-remove.ts"]);
    await git.commit("base");
    const base = (await git.revparse(["HEAD"])).trim();

    fs.rmSync(removedPath);
    await git.add(["to-remove.ts"]);
    await git.commit("head: remove to-remove.ts");
    const head = (await git.revparse(["HEAD"])).trim();

    const pairs = await new GitDiffSource(repoRoot).getChangedFiles(base, head);
    expect(pairs).toEqual([{ filePath: "to-remove.ts", baseContent: "export const z = 3;\n", headContent: undefined }]);

    fs.rmSync(repoRoot, { recursive: true, force: true });
  });
});
