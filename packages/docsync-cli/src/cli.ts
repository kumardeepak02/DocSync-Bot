import { Command } from "commander";
import * as path from "path";
import { checkRepo, formatReport } from "docsync-core";

export interface CliIO {
  stdout: (msg: string) => void;
  stderr: (msg: string) => void;
}

const defaultIO: CliIO = {
  stdout: (msg) => console.log(msg),
  stderr: (msg) => console.error(msg)
};

/**
 * Runs the `docsync-cli check` command and returns a process exit code (0 = success/non-blocking,
 * 1 = blocking drift found, 2 = unexpected error) rather than calling `process.exit` directly, so
 * it stays unit-testable.
 */
export async function runCli(argv: string[], io: CliIO = defaultIO): Promise<number> {
  const program = new Command();
  program
    .name("docsync-cli")
    .description("DocSync-Bot CLI — detects documentation drift between two git revisions")
    .exitOverride();

  let exitCode = 0;

  program
    .command("check")
    .requiredOption("--base <ref>", "base git ref/sha to diff from")
    .requiredOption("--head <ref>", "head git ref/sha to diff to")
    .option("--repo <path>", "repository root", process.cwd())
    .action(async (opts: { base: string; head: string; repo: string }) => {
      try {
        const result = await checkRepo({ repoRoot: path.resolve(opts.repo), base: opts.base, head: opts.head });
        io.stdout(formatReport(result));
        exitCode = result.blocking ? 1 : 0;
      } catch (error) {
        io.stderr(`DocSync-Bot check failed: ${error instanceof Error ? error.message : String(error)}`);
        exitCode = 2;
      }
    });

  try {
    await program.parseAsync(argv);
  } catch (error) {
    // commander throws on --help/--version or invalid args via exitOverride(); surface a non-zero
    // code without crashing the host process.
    if (exitCode === 0) exitCode = 2;
    void error;
  }

  return exitCode;
}
