export interface WorkspacePackageJson {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  workspaces?: string[] | { packages?: string[] };
  bin?: string | Record<string, string>;
  generators?: string;
  schematics?: string;
}
