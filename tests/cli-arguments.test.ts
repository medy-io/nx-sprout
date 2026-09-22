import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { parseCliArguments } from "../src/cli/arguments.ts";

describe("CLI argument parsing", () => {
  const workingDirectory = resolve("test-workspace");

  test("uses the current directory and minimal defaults", () => {
    expect(parseCliArguments([], workingDirectory)).toEqual({
      kind: "run",
      arguments: { workspace: workingDirectory },
    });
  });

  test("parses workspace, Nx binary, and preview options", () => {
    expect(
      parseCliArguments(
        [
          "--workspace",
          "fixtures/workspace",
          "--nx-bin",
          "tools/nx.mjs",
          "--no-preview",
          "--preview-delay",
          "125.5",
        ],
        workingDirectory,
      ),
    ).toEqual({
      kind: "run",
      arguments: {
        workspace: resolve(workingDirectory, "fixtures/workspace"),
        nxBin: "tools/nx.mjs",
        dryRunOnChange: false,
        dryRunDelayMs: 125.5,
      },
    });
  });

  test("allows the final preview flag to take precedence", () => {
    expect(
      parseCliArguments(["--no-preview", "--preview"], workingDirectory),
    ).toEqual({
      kind: "run",
      arguments: { workspace: workingDirectory, dryRunOnChange: true },
    });
  });

  test.each([
    ["--help", "help"],
    ["-h", "help"],
    ["--version", "version"],
    ["-v", "version"],
  ] as const)("recognizes the %s action", (argument, kind) => {
    expect(parseCliArguments([argument], workingDirectory)).toEqual({ kind });
  });

  test.each([
    [["--workspace"], "--workspace requires a directory."],
    [["--nx-bin"], "--nx-bin requires a path relative to the workspace."],
    [["--preview-delay"], "--preview-delay requires milliseconds."],
    [["--preview-delay", "later"], "--preview-delay must be a non-negative number."],
    [["--preview-delay", "-1"], "--preview-delay must be a non-negative number."],
    [["--unknown"], "Unknown argument: --unknown"],
  ] as const)("rejects invalid arguments: %j", (args, message) => {
    expect(() => parseCliArguments([...args], workingDirectory)).toThrow(message);
  });
});
