import { dirname, join, resolve } from "node:path";
import type { NxInvocation } from "./interfaces/nx-invocation.interface.ts";
import type { NxWorkspace } from "./interfaces/nx-workspace.interface.ts";
import type { ProcessResult } from "./interfaces/process-result.interface.ts";
import type { WorkspacePackageJson } from "./interfaces/workspace-package-json.interface.ts";
import { readJson } from "./workspace.ts";

export async function resolveNxInvocation(
  workspace: NxWorkspace,
  overrideNxBin?: string,
): Promise<NxInvocation> {
  const nxBin = overrideNxBin
    ? resolve(workspace.root, overrideNxBin)
    : await resolveWorkspaceNxBin(workspace.root);
  const node = process.env.NX_SPROUT_NODE_PATH ?? Bun.which("node");
  if (!node) throw new Error("Node.js was not found on PATH; Nx requires Node.js.");

  return {
    executable: node,
    prefixArguments: [nxBin],
    displayExecutable: "nx",
  };
}

const CANCELLED_EXIT_CODE = 130;
const FORCE_KILL_DELAY_MS = 2_000;

interface CompletedProcess {
  exitCode: number;
  stdout: string;
  stderr: string;
}

interface ActiveProcess {
  process: Bun.Subprocess;
  completion: Promise<CompletedProcess>;
  cancellationRequested: boolean;
  settled: boolean;
  forceKillTimer?: ReturnType<typeof setTimeout>;
}

export class NxProcessRunner {
  private active: ActiveProcess | undefined;
  private runVersion = 0;

  constructor(
    private readonly workspaceRoot: string,
    private readonly invocation: NxInvocation,
    private readonly forceKillDelayMs = FORCE_KILL_DELAY_MS,
  ) {}

  cancel(): void {
    this.runVersion += 1;
    this.requestCancellation(this.active);
  }

  async run(args: string[]): Promise<ProcessResult> {
    const version = ++this.runVersion;
    const previous = this.active;
    if (previous) {
      this.requestCancellation(previous);
      try {
        await previous.completion;
      } catch {
        // The superseding run may proceed after the previous process has settled.
      }
    }

    if (version !== this.runVersion) return cancelledProcessResult();

    const processHandle = Bun.spawn(
      [this.invocation.executable, ...this.invocation.prefixArguments, ...args],
      {
        cwd: this.workspaceRoot,
        env: { ...process.env, NX_DAEMON: "false" },
        stdin: "ignore",
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    const completion = Promise.all([
      new Response(processHandle.stdout).text(),
      new Response(processHandle.stderr).text(),
      processHandle.exited,
    ]).then(([stdout, stderr, exitCode]) => ({ exitCode, stdout, stderr }));
    const active: ActiveProcess = {
      process: processHandle,
      completion,
      cancellationRequested: false,
      settled: false,
    };
    this.active = active;

    try {
      const result = await completion;
      return {
        ...result,
        cancelled: active.cancellationRequested || processHandle.signalCode !== null,
      };
    } finally {
      active.settled = true;
      if (active.forceKillTimer) clearTimeout(active.forceKillTimer);
      if (this.active === active) this.active = undefined;
    }
  }

  private requestCancellation(active: ActiveProcess | undefined): void {
    if (!active || active.cancellationRequested || active.settled) return;
    active.cancellationRequested = true;
    try {
      active.process.kill();
    } catch {
      // The process may have exited between the state check and the signal.
    }
    active.forceKillTimer = setTimeout(() => {
      if (active.settled) return;
      try {
        active.process.kill("SIGKILL");
      } catch {
        // The process already exited.
      }
    }, this.forceKillDelayMs);
  }
}

function cancelledProcessResult(): ProcessResult {
  return {
    exitCode: CANCELLED_EXIT_CODE,
    stdout: "",
    stderr: "",
    cancelled: true,
  };
}

async function resolveWorkspaceNxBin(workspaceRoot: string): Promise<string> {
  let current = workspaceRoot;
  while (true) {
    const packagePath = join(current, "node_modules", "nx", "package.json");
    if (await Bun.file(packagePath).exists()) {
      const packageJson = await readJson<WorkspacePackageJson>(packagePath);
      const bin =
        typeof packageJson.bin === "string"
          ? packageJson.bin
          : packageJson.bin?.nx;
      if (!bin) throw new Error(`The nx package at ${packagePath} has no nx binary.`);
      return resolve(dirname(packagePath), bin);
    }

    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }

  throw new Error(
    `Could not resolve the workspace-local Nx binary from ${workspaceRoot}. Run the workspace package manager install first.`,
  );
}
