import * as fs from "fs";
import * as path from "path";
import { DocSyncConfig } from "../types";

const ALWAYS_SKIP_DIRS = new Set(["node_modules", "dist", ".git"]);

function globToRegExp(pattern: string): RegExp {
  const DOUBLE_STAR = "\u0000DOUBLESTAR\u0000";
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, DOUBLE_STAR)
    .replace(/\*/g, "[^/]*")
    .split(DOUBLE_STAR)
    .join(".*");
  return new RegExp(`^${escaped}$`);
}

function isExcluded(relativePath: string, excludePaths: string[]): boolean {
  const normalized = relativePath.replace(/\\/g, "/");
  return excludePaths.some((pattern) => globToRegExp(pattern).test(normalized));
}

export interface ScannedDocFile {
  relativePath: string;
  content: string;
  docType: "markdown" | "openapi";
}

/**
 * Walks the working tree (which, in both the GitHub Action and the VS Code manual-trigger flow,
 * already reflects the HEAD revision being checked) looking for Markdown and OpenAPI files that
 * might document a changed symbol, regardless of whether those doc files themselves changed in
 * this diff.
 */
export function scanRepoDocs(repoRoot: string, config: DocSyncConfig): ScannedDocFile[] {
  const results: ScannedDocFile[] = [];

  const walk = (dir: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(repoRoot, fullPath);

      if (entry.isDirectory()) {
        if (ALWAYS_SKIP_DIRS.has(entry.name)) continue;
        if (isExcluded(relativePath, config.excludePaths)) continue;
        walk(fullPath);
        continue;
      }

      if (isExcluded(relativePath, config.excludePaths)) continue;

      if (/\.(md|markdown)$/i.test(entry.name)) {
        results.push({ relativePath, content: fs.readFileSync(fullPath, "utf-8"), docType: "markdown" });
      } else if (/\.(ya?ml)$/i.test(entry.name)) {
        results.push({ relativePath, content: fs.readFileSync(fullPath, "utf-8"), docType: "openapi" });
      }
    }
  };

  walk(repoRoot);
  return results;
}
