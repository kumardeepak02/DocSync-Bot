/**
 * Defense-in-depth secret redaction applied to any code/diff snippet before it is sent to an LLM
 * provider (NFR-7, NFR-10). This is a best-effort regex screen, not a replacement for proper
 * `.gitignore`/path-exclusion of genuinely sensitive files.
 */

interface SecretPattern {
  label: string;
  pattern: RegExp;
}

const SECRET_PATTERNS: SecretPattern[] = [
  { label: "github-token", pattern: /gh[pousr]_[A-Za-z0-9]{36,}/g },
  { label: "aws-access-key", pattern: /AKIA[0-9A-Z]{16}/g },
  { label: "generic-api-key-assignment", pattern: /(api[_-]?key|secret|token|password)\s*[:=]\s*["'][^"'\s]{8,}["']/gi },
  { label: "private-key-block", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g },
  { label: "connection-string", pattern: /[a-z]+:\/\/[^\s:]+:[^\s@]+@[^\s/]+/gi }
];

/**
 * Replaces any substring matching a known secret shape with `[REDACTED:<label>]`.
 * Pure function: does not mutate the input string.
 */
export function redactSecrets(input: string): string {
  let result = input;
  for (const { label, pattern } of SECRET_PATTERNS) {
    result = result.replace(pattern, `[REDACTED:${label}]`);
  }
  return result;
}
