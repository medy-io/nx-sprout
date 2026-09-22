#!/usr/bin/env bun

import { createCliRenderer } from "@opentui/core";
import { parseCliArguments } from "./cli/arguments.ts";
import {
  defaultNxSproutConfig,
  filterGenerators,
  loadNxSproutConfig,
} from "./config/config.ts";
import { VERSION } from "./constants/version.constant.ts";
import { discoverGenerators } from "./nx/discovery.ts";
import { discoverWorkspaceProjects } from "./nx/projects.ts";
import { NxProcessRunner, resolveNxInvocation } from "./nx/runner.ts";
import { findNxWorkspace } from "./nx/workspace.ts";
import { NxSproutApplication } from "./tui/app.ts";

async function main(): Promise<void> {
  const parsed = parseCliArguments(process.argv.slice(2));
  if (parsed.kind === "version") {
    process.stdout.write(`${VERSION}\n`);
    return;
  }
  if (parsed.kind === "help") {
    process.stdout.write(
      `nx-sprout ${VERSION}\n\n` +
        "Usage: nx-sprout [options]\n\n" +
        "Options:\n" +
        "  --workspace <path>       Nx workspace or a directory inside it\n" +
        "  --nx-bin <path>          Override the workspace-local Nx executable\n" +
        "  --preview                Enable automatic dry-run previews\n" +
        "  --no-preview             Disable automatic dry-run previews\n" +
        "  --preview-delay <ms>     Delay before an automatic dry-run\n" +
        "  -v, --version            Print the version\n" +
        "  -h, --help               Print this help\n",
    );
    return;
  }
  const args = parsed.arguments;
  const workspace = await findNxWorkspace(args.workspace);
  const warnings: string[] = [];
  let config = defaultNxSproutConfig();
  try {
    config = await loadNxSproutConfig(workspace.root);
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : String(error));
  }

  const discoveredGenerators = await discoverGenerators(workspace, {
    onWarning: (warning) => warnings.push(warning),
  });
  const generators = filterGenerators(discoveredGenerators, config);
  if (generators.length === 0) {
    throw new Error(
      `No generator collections were found in ${workspace.root}. Install an Nx plugin or add a local plugin workspace package.`,
    );
  }

  const invocation = await resolveNxInvocation(workspace, args.nxBin);
  const runner = new NxProcessRunner(workspace.workingDirectory, invocation);
  let projects: string[] = [];
  try {
    projects = await discoverWorkspaceProjects(runner);
  } catch (error) {
    warnings.push(error instanceof Error ? error.message : String(error));
  }

  const renderer = await createCliRenderer({
    screenMode: "alternate-screen",
    clearOnShutdown: true,
    exitOnCtrlC: false,
    useMouse: true,
    autoFocus: true,
    targetFps: 30,
  });
  const app = new NxSproutApplication(renderer, {
    workspace,
    generators,
    projects,
    invocation,
    runner,
    warnings,
    dryRunOnChange: args.dryRunOnChange ?? config.dryRunOnChange,
    dryRunDelayMs: args.dryRunDelayMs ?? config.dryRunDelayMs,
    showInternalOptions: config.showInternalOptions,
  });

  process.once("SIGINT", () => app.destroy());
  process.once("SIGTERM", () => app.destroy());
  app.mount();
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`nx-sprout: ${message}\n`);
  process.exitCode = 1;
});
