import { join } from "node:path";
import type { GeneratorDescriptor } from "../domain/interfaces/generator-descriptor.interface.ts";
import { DEFAULT_NX_SPROUT_CONFIG } from "./constants/default-nx-sprout-config.constant.ts";
import type { NxSproutConfig } from "./interfaces/nx-sprout-config.interface.ts";

export async function loadNxSproutConfig(workspaceRoot: string): Promise<NxSproutConfig> {
  const path = join(workspaceRoot, ".nx-sprout.json");
  if (!(await Bun.file(path).exists())) return defaultNxSproutConfig();

  let value: unknown;
  try {
    value = await Bun.file(path).json();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not read ${path}: ${message}`, { cause: error });
  }

  if (!isRecord(value)) throw new Error(`${path} must contain a JSON object.`);

  return {
    generatorAllowlist: stringArray(value.generatorAllowlist, "generatorAllowlist", path),
    generatorBlocklist: stringArray(value.generatorBlocklist, "generatorBlocklist", path),
    dryRunOnChange: booleanValue(
      value.dryRunOnChange,
      "dryRunOnChange",
      path,
      DEFAULT_NX_SPROUT_CONFIG.dryRunOnChange,
    ),
    dryRunDelayMs: nonNegativeNumber(
      value.dryRunDelayMs,
      "dryRunDelayMs",
      path,
      DEFAULT_NX_SPROUT_CONFIG.dryRunDelayMs,
    ),
    showInternalOptions: booleanValue(
      value.showInternalOptions,
      "showInternalOptions",
      path,
      DEFAULT_NX_SPROUT_CONFIG.showInternalOptions,
    ),
  };
}

export function defaultNxSproutConfig(): NxSproutConfig {
  return {
    ...DEFAULT_NX_SPROUT_CONFIG,
    generatorAllowlist: [...DEFAULT_NX_SPROUT_CONFIG.generatorAllowlist],
    generatorBlocklist: [...DEFAULT_NX_SPROUT_CONFIG.generatorBlocklist],
  };
}

export function filterGenerators(
  generators: GeneratorDescriptor[],
  config: Pick<NxSproutConfig, "generatorAllowlist" | "generatorBlocklist">,
): GeneratorDescriptor[] {
  return generators.filter((generator) => {
    const allowed =
      config.generatorAllowlist.length === 0 ||
      config.generatorAllowlist.some((pattern) => matchesPattern(generator.id, pattern));
    const blocked = config.generatorBlocklist.some((pattern) =>
      matchesPattern(generator.id, pattern),
    );
    return allowed && !blocked;
  });
}

function matchesPattern(value: string, pattern: string): boolean {
  if (!pattern.includes("*")) return value === pattern;

  const parts = pattern.split("*").filter((part) => part.length > 0);
  if (!pattern.startsWith("*") && !value.startsWith(parts[0] ?? "")) return false;
  if (!pattern.endsWith("*") && !value.endsWith(parts.at(-1) ?? "")) return false;

  let offset = 0;
  for (const part of parts) {
    const index = value.indexOf(part, offset);
    if (index < 0) return false;
    offset = index + part.length;
  }
  return true;
}

function stringArray(value: unknown, name: string, path: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new Error(`${path}: ${name} must be an array of strings.`);
  }
  return [...value];
}

function booleanValue(
  value: unknown,
  name: string,
  path: string,
  fallback: boolean,
): boolean {
  if (value === undefined) return fallback;
  if (typeof value !== "boolean") throw new Error(`${path}: ${name} must be a boolean.`);
  return value;
}

function nonNegativeNumber(
  value: unknown,
  name: string,
  path: string,
  fallback: number,
): number {
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${path}: ${name} must be a non-negative number.`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
