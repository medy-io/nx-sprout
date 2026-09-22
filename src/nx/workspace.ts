import { dirname, join, resolve } from "node:path";
import type { NxWorkspace } from "./interfaces/nx-workspace.interface.ts";
import type { WorkspacePackageJson } from "./interfaces/workspace-package-json.interface.ts";

export async function findNxWorkspace(startDirectory: string): Promise<NxWorkspace> {
  const workingDirectory = resolve(startDirectory);
  let current = workingDirectory;

  while (true) {
    const nxJsonPath = join(current, "nx.json");
    const packageJsonPath = join(current, "package.json");

    if ((await Bun.file(nxJsonPath).exists()) && (await Bun.file(packageJsonPath).exists())) {
      return {
        root: current,
        workingDirectory,
        nxJsonPath,
        packageJsonPath,
        packageJson: await readJson<WorkspacePackageJson>(packageJsonPath),
      };
    }

    const parent = dirname(current);
    if (parent === current) {
      throw new Error(`No Nx workspace found from ${resolve(startDirectory)}`);
    }
    current = parent;
  }
}

export async function readJson<T>(path: string): Promise<T> {
  try {
    return (await Bun.file(path).json()) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not read JSON at ${path}: ${message}`, { cause: error });
  }
}
