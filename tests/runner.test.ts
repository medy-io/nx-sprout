import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { NxProcessRunner, resolveNxInvocation } from "../src/nx/runner.ts";
import { findNxWorkspace } from "../src/nx/workspace.ts";

const fixtureRoot = resolve(import.meta.dir, "fixtures/nx-workspace");

describe("Nx process boundary", () => {
  test("runs the Nx entry point under Node and captures dry-run output", async () => {
    const workspace = await findNxWorkspace(fixtureRoot);
    const invocation = await resolveNxInvocation(workspace, "tools/fake-nx.mjs");
    const runner = new NxProcessRunner(workspace.root, invocation);
    const result = await runner.run([
      "generate",
      "@nx/angular:component",
      "profile-card",
      "--dry-run",
      "--no-interactive",
    ]);

    expect(invocation.executable).toContain("node");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("NX dry run for @nx/angular:component");
    expect(result.stdout).toContain("The dry run made no changes");
  });

  test("cancels an obsolete dry run before starting the next one", async () => {
    const workspace = await findNxWorkspace(fixtureRoot);
    const invocation = await resolveNxInvocation(workspace, "tools/fake-nx.mjs");
    const runner = new NxProcessRunner(workspace.root, invocation);

    const obsoleteRun = runner.run(["generate", "fixture:slow", "--slow", "--dry-run"]);
    await Bun.sleep(25);
    const latestRun = runner.run(["generate", "fixture:fast", "--dry-run"]);
    const [obsoleteResult, latestResult] = await Promise.all([obsoleteRun, latestRun]);

    expect(obsoleteResult.cancelled).toBe(true);
    expect(latestResult.exitCode).toBe(0);
    expect(latestResult.stdout).toContain("fixture:fast");
  });
  test("captures stderr and the exit code from a failed Nx process", async () => {
    const workspace = await findNxWorkspace(fixtureRoot);
    const invocation = await resolveNxInvocation(workspace, "tools/fake-nx.mjs");
    const runner = new NxProcessRunner(workspace.root, invocation);

    const result = await runner.run([
      "generate",
      "fixture:broken",
      "--fail",
      "--dry-run",
    ]);

    expect(result.cancelled).toBe(false);
    expect(result.exitCode).toBe(7);
    expect(result.stderr).toContain("NX generator failed");
  });

  test("cancels the active Nx process explicitly", async () => {
    const workspace = await findNxWorkspace(fixtureRoot);
    const invocation = await resolveNxInvocation(workspace, "tools/fake-nx.mjs");
    const runner = new NxProcessRunner(workspace.root, invocation);

    const pendingResult = runner.run(["generate", "fixture:slow", "--slow", "--dry-run"]);
    await Bun.sleep(25);
    runner.cancel();

    await expect(pendingResult).resolves.toMatchObject({ cancelled: true });
  });

  test("waits for cancellation to settle before starting a replacement", async () => {
    if (process.platform === "win32") return;

    const directory = await mkdtemp(join(tmpdir(), "nx-sprout-runner-"));
    const readyMarker = join(directory, "ready");
    const shutdownMarker = join(directory, "stopped");
    try {
      const workspace = await findNxWorkspace(fixtureRoot);
      const invocation = await resolveNxInvocation(workspace, "tools/fake-nx.mjs");
      const runner = new NxProcessRunner(workspace.root, invocation);
      const obsoleteRun = runner.run([
        "generate",
        "fixture:slow",
        "--slow-shutdown",
        "--ready-marker",
        readyMarker,
        "--shutdown-marker",
        shutdownMarker,
      ]);

      await expect(waitForFile(readyMarker)).resolves.toBe(true);
      const supersededRun = runner.run([
        "generate",
        "fixture:superseded",
        "--require-marker",
        shutdownMarker,
        "--dry-run",
      ]);
      const replacementRun = runner.run([
        "generate",
        "fixture:replacement",
        "--require-marker",
        shutdownMarker,
        "--dry-run",
      ]);
      const [obsoleteResult, supersededResult, replacementResult] = await Promise.all([
        obsoleteRun,
        supersededRun,
        replacementRun,
      ]);

      expect(obsoleteResult.cancelled).toBe(true);
      expect(supersededResult).toEqual({
        exitCode: 130,
        stdout: "",
        stderr: "",
        cancelled: true,
      });
      expect(replacementResult.exitCode).toBe(0);
      expect(replacementResult.stderr).not.toContain("before cancellation completed");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  test("force-kills a process that does not stop after the graceful signal", async () => {
    if (process.platform === "win32") return;

    const directory = await mkdtemp(join(tmpdir(), "nx-sprout-force-kill-"));
    const readyMarker = join(directory, "ready");
    try {
      const workspace = await findNxWorkspace(fixtureRoot);
      const invocation = await resolveNxInvocation(workspace, "tools/fake-nx.mjs");
      const runner = new NxProcessRunner(workspace.root, invocation, 50);
      const stubbornRun = runner.run([
        "generate",
        "fixture:stubborn",
        "--ignore-sigterm",
        "--ready-marker",
        readyMarker,
      ]);

      await expect(waitForFile(readyMarker)).resolves.toBe(true);
      const replacementRun = runner.run([
        "generate",
        "fixture:replacement",
        "--dry-run",
      ]);
      const [stubbornResult, replacementResult] = await Promise.all([
        stubbornRun,
        replacementRun,
      ]);

      expect(stubbornResult.cancelled).toBe(true);
      expect(replacementResult.exitCode).toBe(0);
      expect(replacementResult.stdout).toContain("fixture:replacement");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

async function waitForFile(path: string): Promise<boolean> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (await Bun.file(path).exists()) return true;
    await Bun.sleep(10);
  }
  return false;
}
