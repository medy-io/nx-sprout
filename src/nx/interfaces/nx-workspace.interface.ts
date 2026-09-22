import type { WorkspacePackageJson } from "./workspace-package-json.interface.ts";

export interface NxWorkspace {
  root: string;
  workingDirectory: string;
  nxJsonPath: string;
  packageJsonPath: string;
  packageJson: WorkspacePackageJson;
}
