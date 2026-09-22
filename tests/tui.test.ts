import { afterEach, describe, expect, test } from "bun:test";
import { createTestRenderer, type TestRendererSetup } from "@opentui/core/testing";
import { resolve } from "node:path";
import { discoverGenerators } from "../src/nx/discovery.ts";
import type { ProcessResult } from "../src/nx/interfaces/process-result.interface.ts";
import { findNxWorkspace } from "../src/nx/workspace.ts";
import { NxSproutApplication } from "../src/tui/app.ts";
import type { ProcessRunner } from "../src/nx/interfaces/process-runner.interface.ts";

const fixtureRoot = resolve(import.meta.dir, "fixtures/nx-workspace");

class FakeRunner implements ProcessRunner {
  readonly calls: string[][] = [];
  cancelCount = 0;

  cancel(): void {
    this.cancelCount += 1;
  }

  async run(args: string[]): Promise<ProcessResult> {
    this.calls.push(args);
    return {
      exitCode: 0,
      stdout: args.includes("--dry-run")
        ? "CREATE apps/demo/src/app/profile-card.ts\nNOTE: dry run only"
        : "NX executed @nx/angular:component for profile-card",
      stderr: "",
      cancelled: false,
    };
  }
}

class PendingRunner implements ProcessRunner {
  readonly calls: string[][] = [];
  cancelCount = 0;
  private completeRun: ((result: ProcessResult) => void) | undefined;

  cancel(): void {
    this.cancelCount += 1;
    this.completeRun?.({
      exitCode: 130,
      stdout: "",
      stderr: "",
      cancelled: true,
    });
    this.completeRun = undefined;
  }

  run(args: string[]): Promise<ProcessResult> {
    this.calls.push(args);
    return new Promise((resolve) => {
      this.completeRun = resolve;
    });
  }
}

async function openValidComponentForm(setup: TestRendererSetup): Promise<void> {
  await setup.renderOnce();
  await setup.mockInput.typeText("component");
  setup.mockInput.pressEnter();
  setup.mockInput.pressEnter();
  await setup.flush();
  await setup.mockInput.typeText("profile-card");
  setup.mockInput.pressTab();
  setup.mockInput.pressArrow("down");
  await setup.flush();
}

describe("OpenTUI interaction proof", () => {
  let setup: TestRendererSetup | undefined;
  let app: NxSproutApplication | undefined;

  afterEach(() => {
    if (app && setup && !setup.renderer.isDestroyed) app.destroy();
    app = undefined;
    setup = undefined;
  });

  test("filters generators, opens a schema form, validates it, and runs a live dry run", async () => {
    const workspace = await findNxWorkspace(fixtureRoot);
    const generators = await discoverGenerators(workspace);
    const runner = new FakeRunner();
    setup = await createTestRenderer({ width: 120, height: 38 });
    app = new NxSproutApplication(setup.renderer, {
      workspace,
      generators,
      projects: ["demo-app"],
      invocation: {
        executable: "node",
        prefixArguments: ["fake-nx.mjs"],
        displayExecutable: "nx",
      },
      runner,
      dryRunDelayMs: 0,
    });
    app.mount();
    await setup.renderOnce();

    expect(setup.captureCharFrame()).toContain("Choose an Nx generator");
    expect(setup.captureCharFrame()).toContain("@nx/angular:component");

    await setup.mockInput.typeText("component");
    setup.mockInput.pressEnter();
    setup.mockInput.pressEnter();
    await setup.flush();

    let frame = setup.captureCharFrame();
    expect(frame).toContain("Generator options");
    expect(frame).toContain("name *");
    expect(frame).toContain("project *");
    expect(frame).toContain("name: must have required property");

    await setup.mockInput.typeText("profile-card");
    setup.mockInput.pressTab();
    setup.mockInput.pressArrow("down");
    await Bun.sleep(25);
    await setup.waitFor(() => runner.calls.length > 0);
    await setup.flush();

    frame = setup.captureCharFrame();
    expect(runner.calls.at(-1)).toContain("--dry-run");
    expect(frame).toContain("CREATE apps/demo/src/app/profile-card.ts");
    for (let index = 0; index < 5; index += 1) setup.mockInput.pressTab();
    await setup.flush();
    frame = setup.captureCharFrame();
    expect(frame).toContain("legacy");
    expect(frame).toContain("nx generate @nx/angular:component profile-card");

    const callsBeforeConfirmation = runner.calls.length;
    setup.mockInput.pressKey("g", { ctrl: true });
    await setup.flush();
    frame = setup.captureCharFrame();
    expect(frame).toContain("Confirm workspace changes");
    expect(frame).toContain("may create or modify files");
    expect(runner.calls.length).toBe(callsBeforeConfirmation);

    setup.mockInput.pressEnter();
    await setup.waitFor(() => runner.calls.length > callsBeforeConfirmation);
    await setup.flush();
    expect(runner.calls.at(-1)).not.toContain("--dry-run");
    expect(setup.captureCharFrame()).toContain("NX executed @nx/angular:component");
  });
  test("toggles x-prompt multiselect choices and sends each selected value", async () => {
    const workspace = await findNxWorkspace(fixtureRoot);
    const generators = await discoverGenerators(workspace);
    const runner = new FakeRunner();
    setup = await createTestRenderer({ width: 120, height: 38 });
    app = new NxSproutApplication(setup.renderer, {
      workspace,
      generators,
      projects: ["demo-app"],
      invocation: {
        executable: "node",
        prefixArguments: ["fake-nx.mjs"],
        displayExecutable: "nx",
      },
      runner,
      dryRunDelayMs: 0,
    });
    app.mount();
    await setup.renderOnce();

    await setup.mockInput.typeText("library");
    setup.mockInput.pressEnter();
    setup.mockInput.pressEnter();
    await setup.flush();
    await setup.mockInput.typeText("design-system");
    setup.mockInput.pressTab();
    setup.mockInput.pressTab();
    setup.mockInput.pressTab();
    await setup.flush();
    setup.mockInput.pressEnter();
    await setup.flush();
    setup.mockInput.pressArrow("down");
    setup.mockInput.pressKey(" ");
    await Bun.sleep(25);
    await setup.waitFor(() =>
      runner.calls.some((args) => args.filter((argument) => argument === "--tags").length === 2),
    );
    await setup.flush();

    const call = runner.calls.at(-1) ?? [];
    expect(call).toContain("ui");
    expect(call).toContain("shared");
    expect(setup.captureCharFrame()).toContain("[x] UI");
    expect(setup.captureCharFrame()).toContain("[x] Shared");

    setup.mockInput.pressCtrlC();
    expect(setup.renderer.isDestroyed).toBe(true);
  });
  test("renders nonzero exits and thrown process errors", async () => {
    const workspace = await findNxWorkspace(fixtureRoot);
    const generators = await discoverGenerators(workspace);
    const calls: string[][] = [];
    const runner = {
      cancel() {},
      async run(args: string[]): Promise<ProcessResult> {
        calls.push(args);
        if (calls.length === 1) {
          return {
            exitCode: 2,
            stdout: "Partial generator output",
            stderr: "NX generator failed: permission denied",
            cancelled: false,
          };
        }
        throw new Error("Could not start Nx process");
      },
    } satisfies ProcessRunner;
    setup = await createTestRenderer({ width: 120, height: 38 });
    app = new NxSproutApplication(setup.renderer, {
      workspace,
      generators,
      projects: ["demo-app"],
      invocation: {
        executable: "node",
        prefixArguments: ["fake-nx.mjs"],
        displayExecutable: "nx",
      },
      runner,
      dryRunOnChange: false,
    });
    app.mount();
    await openValidComponentForm(setup);

    setup.mockInput.pressKey("r", { ctrl: true });
    await setup.waitFor(() => calls.length === 1);
    await setup.flush();
    let frame = setup.captureCharFrame();
    expect(frame).toContain("Partial generator output");
    expect(frame).toContain("NX generator failed: permission denied");

    setup.mockInput.pressKey("r", { ctrl: true });
    await setup.waitFor(() => calls.length === 2);
    await setup.flush();
    frame = setup.captureCharFrame();
    expect(frame).toContain("Could not start Nx process");
  });

  test("ignores a cancelled preview result and permits a retry", async () => {
    const workspace = await findNxWorkspace(fixtureRoot);
    const generators = await discoverGenerators(workspace);
    const calls: string[][] = [];
    const runner = {
      cancel() {},
      async run(args: string[]): Promise<ProcessResult> {
        calls.push(args);
        return calls.length === 1
          ? {
              exitCode: 143,
              stdout: "cancelled output must not render",
              stderr: "",
              cancelled: true,
            }
          : {
              exitCode: 0,
              stdout: "Retry completed",
              stderr: "",
              cancelled: false,
            };
      },
    } satisfies ProcessRunner;
    setup = await createTestRenderer({ width: 120, height: 38 });
    app = new NxSproutApplication(setup.renderer, {
      workspace,
      generators,
      projects: ["demo-app"],
      invocation: {
        executable: "node",
        prefixArguments: ["fake-nx.mjs"],
        displayExecutable: "nx",
      },
      runner,
      dryRunOnChange: false,
    });
    app.mount();
    await openValidComponentForm(setup);

    setup.mockInput.pressKey("r", { ctrl: true });
    await setup.waitFor(() => calls.length === 1);
    await setup.flush();
    expect(setup.captureCharFrame()).not.toContain("cancelled output must not render");

    setup.mockInput.pressKey("r", { ctrl: true });
    await setup.waitFor(() => calls.length === 2);
    await setup.flush();
    expect(setup.captureCharFrame()).toContain("Retry completed");
  });

  test("warns about mutation cancellation and blocks Escape while execution is active", async () => {
    const workspace = await findNxWorkspace(fixtureRoot);
    const generators = await discoverGenerators(workspace);
    const runner = new PendingRunner();
    setup = await createTestRenderer({ width: 120, height: 38 });
    app = new NxSproutApplication(setup.renderer, {
      workspace,
      generators,
      projects: ["demo-app"],
      invocation: {
        executable: "node",
        prefixArguments: ["fake-nx.mjs"],
        displayExecutable: "nx",
      },
      runner,
      dryRunOnChange: false,
    });
    app.mount();
    await openValidComponentForm(setup);

    setup.mockInput.pressKey("g", { ctrl: true });
    await setup.flush();
    setup.mockInput.pressEnter();
    await setup.waitFor(() => runner.calls.length === 1);
    await setup.flush();
    expect(setup.captureCharFrame()).toContain("may leave partial changes");

    const cancelCountBeforeEscape = runner.cancelCount;
    setup.mockInput.pressEscape();
    await setup.flush();
    expect(setup.captureCharFrame()).toContain("Generator execution");
    expect(runner.cancelCount).toBe(cancelCountBeforeEscape);

    setup.mockInput.pressCtrlC();
    await setup.flush();
    expect(setup.renderer.isDestroyed).toBe(true);
    expect(runner.cancelCount).toBe(cancelCountBeforeEscape + 1);
  });
});
