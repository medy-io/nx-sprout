import { resolve } from "node:path";
import type { CliArguments } from "../interfaces/cli-arguments.interface.ts";

export type CliParseResult =
  | { kind: "run"; arguments: CliArguments }
  | { kind: "help" }
  | { kind: "version" };

export function parseCliArguments(
  args: string[],
  workingDirectory = process.cwd(),
): CliParseResult {
  let workspace = resolve(workingDirectory);
  let nxBin: string | undefined;
  let dryRunOnChange: boolean | undefined;
  let dryRunDelayMs: number | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--workspace") {
      const value = args[index + 1];
      if (!value) throw new Error("--workspace requires a directory.");
      workspace = resolve(workingDirectory, value);
      index += 1;
    } else if (argument === "--nx-bin") {
      const value = args[index + 1];
      if (!value) throw new Error("--nx-bin requires a path relative to the workspace.");
      nxBin = value;
      index += 1;
    } else if (argument === "--preview") {
      dryRunOnChange = true;
    } else if (argument === "--no-preview") {
      dryRunOnChange = false;
    } else if (argument === "--preview-delay") {
      const value = args[index + 1];
      if (value === undefined) throw new Error("--preview-delay requires milliseconds.");
      dryRunDelayMs = Number(value);
      if (!Number.isFinite(dryRunDelayMs) || dryRunDelayMs < 0) {
        throw new Error("--preview-delay must be a non-negative number.");
      }
      index += 1;
    } else if (argument === "--version" || argument === "-v") {
      return { kind: "version" };
    } else if (argument === "--help" || argument === "-h") {
      return { kind: "help" };
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  return {
    kind: "run",
    arguments: {
      workspace,
      ...(nxBin ? { nxBin } : {}),
      ...(dryRunOnChange === undefined ? {} : { dryRunOnChange }),
      ...(dryRunDelayMs === undefined ? {} : { dryRunDelayMs }),
    },
  };
}
