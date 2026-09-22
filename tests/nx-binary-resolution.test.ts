import { afterEach, describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { NxWorkspace } from "../src/nx/interfaces/nx-workspace.interface.ts";
import { resolveNxInvocation } from "../src/nx/runner.ts";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  const directories = temporaryDirectories.splice(0);
  await Promise.all(directories.map((directory) => rm(directory, { recursive: true })));
});

async function temporaryWorkspace(
  relativeWorkspacePath = ".",
): Promise<{ tempRoot: string; workspace: NxWorkspace }> {
  const tempRoot = await mkdtemp(join(tmpdir(), "nx-sprout-runner-"));
  temporaryDirectories.push(tempRoot);
  const root = resolve(tempRoot, relativeWorkspacePath);
  await mkdir(root, { recursive: true });

  return {
    tempRoot,
    workspace: {
      root,
      workingDirectory: root,
      nxJsonPath: join(root, "nx.json"),
      packageJsonPath: join(root, "package.json"),
      packageJson: { name: "temporary-workspace" },
    },
  };
}

async function installNx(
  packageRoot: string,
  bin: string | Record<string, string> | undefined,
): Promise<string> {
  const nxRoot = join(packageRoot, "node_modules", "nx");
  await mkdir(join(nxRoot, "bin"), { recursive: true });
  await Bun.write(
    join(nxRoot, "package.json"),
    JSON.stringify({ name: "nx", bin }),
  );
  return nxRoot;
}

describe("Nx binary resolution", () => {
  test("resolves the Nx executable from an object bin entry", async () => {
    const { workspace } = await temporaryWorkspace();
    const nxRoot = await installNx(workspace.root, { nx: "./bin/nx.js" });

    const invocation = await resolveNxInvocation(workspace);

    expect(invocation.displayExecutable).toBe("nx");
    expect(invocation.prefixArguments).toEqual([resolve(nxRoot, "bin/nx.js")]);
  });

  test("walks parent directories and accepts a string bin entry", async () => {
    const { tempRoot, workspace } = await temporaryWorkspace("packages/demo");
    const nxRoot = await installNx(tempRoot, "./bin/nx.js");

    const invocation = await resolveNxInvocation(workspace);

    expect(invocation.prefixArguments).toEqual([resolve(nxRoot, "bin/nx.js")]);
  });

  test("rejects an Nx package that does not declare a binary", async () => {
    const { workspace } = await temporaryWorkspace();
    await installNx(workspace.root, undefined);

    await expect(resolveNxInvocation(workspace)).rejects.toThrow(
      "has no nx binary",
    );
  });

  test("reports when no workspace-local Nx package is installed", async () => {
    const { workspace } = await temporaryWorkspace();

    await expect(resolveNxInvocation(workspace)).rejects.toThrow(
      "Could not resolve the workspace-local Nx binary",
    );
  });
});
