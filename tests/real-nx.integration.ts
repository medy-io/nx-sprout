import { describe, expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { generatorArguments } from "../src/nx/command.ts";
import { discoverGenerators } from "../src/nx/discovery.ts";
import { discoverWorkspaceProjects } from "../src/nx/projects.ts";
import { NxProcessRunner, resolveNxInvocation } from "../src/nx/runner.ts";
import { findNxWorkspace } from "../src/nx/workspace.ts";

const fixtureRoot = resolve(import.meta.dir, "fixtures/real-nx-workspace");

describe("real Nx compatibility", () => {
  test("discovers installed and local generators in a real workspace", async () => {
    const workspace = await findNxWorkspace(
      join(fixtureRoot, "plugins/real-plugin"),
    );
    const generators = await discoverGenerators(workspace);

    expect(generators.map((generator) => generator.id)).toEqual([
      "@fixture/installed-plugin:write-file",
      "@fixture/real-plugin:write-file",
    ]);
  });

  test("discovers projects and executes a real Nx generator dry run", async () => {
    const workspace = await findNxWorkspace(fixtureRoot);
    const generators = await discoverGenerators(workspace);
    const generator = generators.find(
      (candidate) => candidate.id === "@fixture/installed-plugin:write-file",
    );
    if (!generator) throw new Error("The installed Nx fixture generator was not discovered.");

    const invocation = await resolveNxInvocation(workspace);
    const runner = new NxProcessRunner(workspace.root, invocation);
    const projects = await discoverWorkspaceProjects(runner);
    expect(projects).toContain("demo-app");

    const generatedPath = join(
      fixtureRoot,
      "apps/demo-app/generated/compatibility-check.txt",
    );
    expect(await Bun.file(generatedPath).exists()).toBe(false);

    const result = await runner.run(
      generatorArguments({
        generator,
        values: {
          name: "compatibility-check",
          project: "demo-app",
        },
        dryRun: true,
      }),
    );

    expect(result.cancelled).toBe(false);
    expect(result.exitCode).toBe(0);
    const output = `${result.stdout}\n${result.stderr}`;
    expect(output).toContain("compatibility-check.txt");
    expect(output).toContain("no changes were made");
    expect(await Bun.file(generatedPath).exists()).toBe(false);
  });

  test("commits a successful mutation and does not commit a failed virtual tree", async () => {
    const workspace = await findNxWorkspace(fixtureRoot);
    const generators = await discoverGenerators(workspace);
    const generator = generators.find(
      (candidate) => candidate.id === "@fixture/installed-plugin:write-file",
    );
    if (!generator) throw new Error("The installed Nx fixture generator was not discovered.");

    const invocation = await resolveNxInvocation(workspace);
    const runner = new NxProcessRunner(workspace.root, invocation);
    const generatedDirectory = join(fixtureRoot, "apps/demo-app/generated");
    const successPath = join(generatedDirectory, "compatibility-write.txt");
    const failedPath = join(generatedDirectory, "compatibility-failure.txt");

    try {
      const success = await runner.run(
        generatorArguments({
          generator,
          values: { name: "compatibility-write", project: "demo-app" },
          dryRun: false,
        }),
      );
      expect(success.cancelled).toBe(false);
      expect(success.exitCode).toBe(0);
      expect(await Bun.file(successPath).text()).toContain("compatibility-write");

      const failure = await runner.run(
        generatorArguments({
          generator,
          values: {
            name: "compatibility-failure",
            project: "demo-app",
            failAfterWrite: true,
          },
          dryRun: false,
        }),
      );
      expect(failure.cancelled).toBe(false);
      expect(failure.exitCode).not.toBe(0);
      expect(`${failure.stdout}\n${failure.stderr}`).toContain(
        "Fixture failure after writing to the virtual tree",
      );
      expect(await Bun.file(failedPath).exists()).toBe(false);
    } finally {
      await rm(generatedDirectory, { recursive: true, force: true });
    }
  });
});
