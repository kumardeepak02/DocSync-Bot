import { redactSecrets } from "../src/util/redactSecrets";

describe("redactSecrets", () => {
  it("redacts a GitHub personal access token", () => {
    const input = "token: ghp_1234567890abcdef1234567890abcdef1234";
    expect(redactSecrets(input)).not.toContain("ghp_1234567890abcdef1234567890abcdef1234");
    expect(redactSecrets(input)).toContain("[REDACTED:github-token]");
  });

  it("redacts an AWS access key", () => {
    const input = "AWS_ACCESS_KEY_ID=AKIAABCDEFGHIJKLMNOP";
    expect(redactSecrets(input)).toContain("[REDACTED:aws-access-key]");
  });

  it("redacts a generic apiKey assignment", () => {
    const input = 'const apiKey = "sk-abcdef1234567890";';
    expect(redactSecrets(input)).toContain("[REDACTED:generic-api-key-assignment]");
    expect(redactSecrets(input)).not.toContain("sk-abcdef1234567890");
  });

  it("redacts a PEM private key block", () => {
    const input = "-----BEGIN RSA PRIVATE KEY-----\nMIIBogIBAAJ...\n-----END RSA PRIVATE KEY-----";
    expect(redactSecrets(input)).toBe("[REDACTED:private-key-block]");
  });

  it("redacts a connection string with embedded credentials", () => {
    const input = "postgres://admin:sup3rSecret@db.internal:5432/app";
    expect(redactSecrets(input)).toContain("[REDACTED:connection-string]");
  });

  it("leaves normal code untouched", () => {
    const input = "export function add(a: number, b: number): number {\n  return a + b;\n}";
    expect(redactSecrets(input)).toBe(input);
  });
});

