import { dirname, isAbsolute, join } from "node:path";
import type { GeneratorDescriptor } from "../domain/interfaces/generator-descriptor.interface.ts";
import type { GeneratorSchema } from "../domain/interfaces/generator-schema.interface.ts";
import type { GeneratorCollection } from "./interfaces/generator-collection.interface.ts";
import type { GeneratorDiscoveryOptions } from "./interfaces/generator-discovery-options.interface.ts";
import type { NxWorkspace } from "./interfaces/nx-workspace.interface.ts";
import type { PackageCandidate } from "./interfaces/package-candidate.interface.ts";
import type { WorkspacePackageJson } from "./interfaces/workspace-package-json.interface.ts";
import { readJson } from "./workspace.ts";

export async function discoverGenerators(
  workspace: NxWorkspace,
  options: GeneratorDiscoveryOptions = {},
): Promise<GeneratorDescriptor[]> {
  const candidates = await discoverPackageCandidates(workspace, options);
  const groups = await Promise.all(
    candidates.map(async (candidate) => {
      try {
        return await generatorsFromPackage(candidate, workspace.root, options);
      } catch (error) {
        options.onWarning?.(
          `Skipped generator collection ${candidate.name}: ${errorMessage(error)}`,
        );
        return [];
      }
    }),
  );

  return groups.flat().sort(
    (left, right) =>
      left.collection.localeCompare(right.collection) || left.name.localeCompare(right.name),
  );
}

async function discoverPackageCandidates(
  workspace: NxWorkspace,
  options: GeneratorDiscoveryOptions,
): Promise<PackageCandidate[]> {
  const packageNames = new Set([
    ...Object.keys(workspace.packageJson.dependencies ?? {}),
    ...Object.keys(workspace.packageJson.devDependencies ?? {}),
    ...Object.keys(workspace.packageJson.optionalDependencies ?? {}),
  ]);

  const candidates = new Map<string, PackageCandidate>();
  for (const packageName of packageNames) {
    const packageRoot = join(workspace.root, "node_modules", ...packageName.split("/"));
    const packageJsonPath = join(packageRoot, "package.json");
    if (!(await Bun.file(packageJsonPath).exists())) continue;

    try {
      const packageJson = await readJson<WorkspacePackageJson>(packageJsonPath);
      candidates.set(packageName, { name: packageName, root: packageRoot, packageJson });
    } catch (error) {
      options.onWarning?.(`Skipped package ${packageName}: ${errorMessage(error)}`);
    }
  }

  for (const packageRoot of await workspacePackageRoots(workspace)) {
    const packageJsonPath = join(packageRoot, "package.json");
    if (!(await Bun.file(packageJsonPath).exists())) continue;

    try {
      const packageJson = await readJson<WorkspacePackageJson>(packageJsonPath);
      if (!packageJson.name) continue;
      candidates.set(packageJson.name, {
        name: packageJson.name,
        root: packageRoot,
        packageJson,
      });
    } catch (error) {
      options.onWarning?.(
        `Skipped workspace package at ${packageRoot}: ${errorMessage(error)}`,
      );
    }
  }

  return [...candidates.values()];
}

async function workspacePackageRoots(workspace: NxWorkspace): Promise<string[]> {
  const workspaces = Array.isArray(workspace.packageJson.workspaces)
    ? workspace.packageJson.workspaces
    : (workspace.packageJson.workspaces?.packages ?? []);
  const roots = new Set<string>();

  for (const pattern of workspaces) {
    const glob = new Bun.Glob(`${pattern.replace(/\/$/, "")}/package.json`);
    for await (const packageJsonPath of glob.scan({
      cwd: workspace.root,
      absolute: true,
      onlyFiles: true,
    })) {
      roots.add(dirname(packageJsonPath));
    }
  }

  return [...roots];
}

async function generatorsFromPackage(
  candidate: PackageCandidate,
  workspaceRoot: string,
  options: GeneratorDiscoveryOptions,
): Promise<GeneratorDescriptor[]> {
  const collectionReference = candidate.packageJson.generators ?? candidate.packageJson.schematics;
  if (!collectionReference) return [];

  const collectionPath = await resolveCollectionReference(
    candidate.root,
    collectionReference,
    workspaceRoot,
  );
  const collection = await readJson<GeneratorCollection>(collectionPath);
  const entries = collection.generators ?? collection.schematics ?? {};
  const descriptors: GeneratorDescriptor[] = [];

  for (const [name, entry] of Object.entries(entries)) {
    if (!entry.schema || entry.hidden) continue;

    try {
      const schemaPath = resolveReference(dirname(collectionPath), entry.schema);
      const schema = await readJson<GeneratorSchema>(schemaPath);
      descriptors.push({
        id: `${candidate.name}:${name}`,
        collection: candidate.name,
        name,
        aliases:
          typeof entry.aliases === "string" ? [entry.aliases] : (entry.aliases ?? []),
        description: entry.description ?? schema.description ?? "",
        schemaPath,
        schema,
      });
    } catch (error) {
      options.onWarning?.(
        `Skipped generator ${candidate.name}:${name}: ${errorMessage(error)}`,
      );
    }
  }

  return descriptors;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function resolveCollectionReference(
  packageRoot: string,
  reference: string,
  workspaceRoot: string,
): Promise<string> {
  if (isAbsolute(reference) || reference.startsWith(".")) {
    return resolveReference(packageRoot, reference);
  }

  const segments = reference.split("/");
  const packageSegmentCount = reference.startsWith("@") ? 2 : 1;
  const packageName = segments.slice(0, packageSegmentCount).join("/");
  const subpath = segments.slice(packageSegmentCount).join("/");
  const delegatedRoot = join(workspaceRoot, "node_modules", ...packageName.split("/"));
  if (subpath) return resolveReference(delegatedRoot, subpath);

  const packageJsonPath = join(delegatedRoot, "package.json");
  const packageJson = await readJson<WorkspacePackageJson>(packageJsonPath);
  const nestedReference = packageJson.generators ?? packageJson.schematics;
  if (!nestedReference) {
    throw new Error(`Package ${reference} does not expose a generator collection.`);
  }

  return resolveCollectionReference(delegatedRoot, nestedReference, workspaceRoot);
}

function resolveReference(root: string, reference: string): string {
  const absolute = isAbsolute(reference) ? reference : join(root, reference);
  return absolute.endsWith(".json") ? absolute : `${absolute}.json`;
}
