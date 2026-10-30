import * as fs from "fs";
import * as path from "path";
import { DocSyncConfig, DEFAULT_CONFIG } from "../types";

/**
 * Loads `docsync.config.json` from the repo root, falling back to `DEFAULT_CONFIG` (merged with
 * any partial file that is present) when the file is missing or malformed (design review,
 * Finding 8 — absence of config must never crash the tool).
 */
export function loadConfig(repoRoot: string): DocSyncConfig {
  const configPath = path.join(repoRoot, "docsync.config.json");
  if (!fs.existsSync(configPath)) {
    return { ...DEFAULT_CONFIG };
  }

  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw) as Partial<DocSyncConfig>;
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      confluenceLinks: parsed.confluenceLinks ?? DEFAULT_CONFIG.confluenceLinks
    };
  } catch {
    // Malformed JSON: fall back to defaults rather than failing the whole run.
    return { ...DEFAULT_CONFIG };
  }
}
