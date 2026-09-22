import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { generatorFields } from "../src/domain/generator.ts";
import { discoverGenerators } from "../src/nx/discovery.ts";
import { findNxWorkspace } from "../src/nx/workspace.ts";

const fixtureRoot = resolve(import.meta.dir, "fixtures/nx-workspace");

describe("Nx generator discovery", () => {
  test("finds an Nx root from a nested directory", async () => {
    const workspace = await findNxWorkspace(
      resolve(fixtureRoot, "plugins/angular/component"),
    );

    expect(workspace.root).toBe(fixtureRoot);
  });

  test("loads visible generators and their schemas from workspace packages", async () => {
    const workspace = await findNxWorkspace(fixtureRoot);
    const generators = await discoverGenerators(workspace);

    expect(generators.map((generator) => generator.id)).toEqual([
      "@nx/angular:component",
      "@nx/angular:library",
    ]);
    expect(generators[0]?.aliases).toEqual(["c"]);
    expect(generators[0]?.schema.required).toEqual(["name", "project"]);
  });

  test("skips a broken generator schema and reports a warning", async () => {
    const workspace = await findNxWorkspace(fixtureRoot);
    const warnings: string[] = [];
    const generators = await discoverGenerators(workspace, {
      onWarning: (warning) => warnings.push(warning),
    });

    expect(generators.map((generator) => generator.id)).not.toContain("@nx/angular:broken");
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("@nx/angular:broken");
  });

  test("orders required, important, regular, deprecated, and internal fields", async () => {
    const workspace = await findNxWorkspace(fixtureRoot);
    const [component] = await discoverGenerators(workspace);
    if (!component) throw new Error("Component fixture was not discovered.");

    expect(generatorFields(component.schema).map((field) => [field.name, field.priority])).toEqual([
      ["name", "required"],
      ["project", "required"],
      ["changeDetection", "regular"],
      ["skipTests", "regular"],
      ["standalone", "regular"],
      ["style", "regular"],
      ["legacy", "deprecated"],
      ["internalOption", "internal"],
    ]);
  });
});
