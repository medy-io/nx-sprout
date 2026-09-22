import type { WorkspacePackageJson } from "./workspace-package-json.interface.ts";

export interface PackageCandidate {
  name: string;
  root: string;
  packageJson: WorkspacePackageJson;
}
