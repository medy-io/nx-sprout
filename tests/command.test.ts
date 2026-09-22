import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { initialGeneratorValues } from "../src/domain/options.ts";
import { displayCommand, generatorArguments } from "../src/nx/command.ts";
import { discoverGenerators } from "../src/nx/discovery.ts";
import { findNxWorkspace } from "../src/nx/workspace.ts";

const fixtureRoot = resolve(import.meta.dir, "fixtures/nx-workspace");

describe("Nx command construction", () => {
  test("serializes positional, false boolean, and dry-run arguments without a shell", async () => {
    const workspace = await findNxWorkspace(fixtureRoot);
    const [component] = await discoverGenerators(workspace);
    if (!component) throw new Error("Component fixture was not discovered.");

    const values = {
      ...initialGeneratorValues(component),
      name: "user card",
      project: "demo-app",
      skipTests: false,
    };
    const args = generatorArguments({ generator: component, values, dryRun: true });

    expect(args).toEqual([
      "generate",
      "@nx/angular:component",
      "user card",
      "--project",
      "demo-app",
      "--changeDetection",
      "Default",
      "--no-skipTests",
      "--standalone",
      "--style",
      "scss",
      "--dry-run",
      "--no-interactive",
    ]);
    expect(displayCommand("nx", args)).toContain("'user card'");
  });

  test("serializes array entries and structured values without a shell", async () => {
    const workspace = await findNxWorkspace(fixtureRoot);
    const [component] = await discoverGenerators(workspace);
    if (!component) throw new Error("Component fixture was not discovered.");

    const generator = {
      ...component,
      schema: {
        ...component.schema,
        properties: {
          ...component.schema.properties,
          tags: { type: "array", items: { type: "string" } },
          metadata: { type: "object" },
        },
      },
    };
    const args = generatorArguments({
      generator,
      values: {
        name: "card",
        project: "demo-app",
        tags: ["ui", "shared"],
        metadata: { scope: "design-system" },
      },
      dryRun: false,
    });

    expect(args).toContain("--tags");
    expect(args.filter((argument) => argument === "--tags")).toHaveLength(2);
    expect(args).toContain('{"scope":"design-system"}');
    expect(args).not.toContain("--dry-run");
  });
});
