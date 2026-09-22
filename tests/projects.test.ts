import { describe, expect, test } from "bun:test";
import type { ProcessRunner } from "../src/nx/interfaces/process-runner.interface.ts";
import type { ProcessResult } from "../src/nx/interfaces/process-result.interface.ts";
import { discoverWorkspaceProjects, parseProjectOutput } from "../src/nx/projects.ts";

class ProjectRunner implements ProcessRunner {
  readonly calls: string[][] = [];

  cancel(): void {}

  async run(args: string[]): Promise<ProcessResult> {
    this.calls.push(args);
    return {
      exitCode: 0,
      stdout: JSON.stringify(["shop", "api", "shop"]),
      stderr: "",
      cancelled: false,
    };
  }
}

describe("Nx project discovery", () => {
  test("parses, deduplicates, and sorts JSON output with terminal colors", () => {
    expect(parseProjectOutput("\u001b[32m[\"shop\",\"api\",\"shop\"]\u001b[0m")).toEqual([
      "api",
      "shop",
    ]);
  });

  test("supports newline output from older Nx versions", () => {
    expect(parseProjectOutput("NX Projects\nshop\napi\n")).toEqual(["api", "shop"]);
  });

  test("uses the machine-readable Nx show command", async () => {
    const runner = new ProjectRunner();

    await expect(discoverWorkspaceProjects(runner)).resolves.toEqual(["api", "shop"]);
    expect(runner.calls).toEqual([["show", "projects", "--json"]]);
  });

  test("retries without --json for older Nx versions", async () => {
    const calls: string[][] = [];
    const runner: ProcessRunner = {
      cancel() {},
      async run(args) {
        calls.push(args);
        return args.includes("--json")
          ? { exitCode: 1, stdout: "", stderr: "Unknown option --json", cancelled: false }
          : { exitCode: 0, stdout: "shop\napi\n", stderr: "", cancelled: false };
      },
    };

    await expect(discoverWorkspaceProjects(runner)).resolves.toEqual(["api", "shop"]);
    expect(calls).toEqual([
      ["show", "projects", "--json"],
      ["show", "projects"],
    ]);
  });
});
