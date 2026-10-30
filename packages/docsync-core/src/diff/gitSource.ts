import { simpleGit, SimpleGit } from "simple-git";
import { FileVersionPair } from "./diffAnalyzer";

/**
 * Reads the base and head versions of every file changed between two git revisions in a real
 * repository, producing the `FileVersionPair[]` input `diffSymbols` expects. Isolated from
 * `diffAnalyzer.ts` so the pure diffing logic stays unit-testable without a real git repo.
 */
export class GitDiffSource {
  private readonly git: SimpleGit;

  constructor(repoPath: string) {
    this.git = simpleGit(repoPath);
  }

  async getChangedFiles(base: string, head: string): Promise<FileVersionPair[]> {
    const diffSummary = await this.git.diff([`${base}...${head}`, "--name-only"]);
    const filePaths = diffSummary
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const pairs: FileVersionPair[] = [];
    for (const filePath of filePaths) {
      pairs.push({
        filePath,
        baseContent: await this.readAtRevision(base, filePath),
        headContent: await this.readAtRevision(head, filePath)
      });
    }
    return pairs;
  }

  private async readAtRevision(revision: string, filePath: string): Promise<string | undefined> {
    try {
      return await this.git.show([`${revision}:${filePath}`]);
    } catch {
      // File didn't exist at this revision (added or removed).
      return undefined;
    }
  }
}
