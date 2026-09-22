import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  defaultNxSproutConfig,
  filterGenerators,
  loadNxSproutConfig,
} from "../src/config/config.ts";
import type { GeneratorDescriptor } from "../src/domain/interfaces/generator-descriptor.interface.ts";

function generator(id: string): GeneratorDescriptor {
  const [collection = "", name = ""] = id.split(":");
  return {
    id,
    collection,
    name,
    aliases: [],
    description: "",
    schemaPath: "",
    schema: { type: "object" },
  };
}

describe("workspace configuration", () => {
  test("uses independent minimal defaults", () => {
    const first = defaultNxSproutConfig();
    const second = defaultNxSproutConfig();

    first.generatorAllowlist.push("@nx/angular:*");
    expect(second.generatorAllowlist).toEqual([]);
    expect(second.dryRunOnChange).toBe(true);
  });

  test("applies wildcard allowlists and blocklists", () => {
    const generators = [
      generator("@nx/angular:component"),
      generator("@nx/angular:library"),
      generator("@nx/react:component"),
    ];

    expect(
      filterGenerators(generators, {
        generatorAllowlist: ["@nx/angular:*"],
        generatorBlocklist: ["*:library"],
      }).map((item) => item.id),
    ).toEqual(["@nx/angular:component"]);
  });

  test("loads validated settings from the workspace", async () => {
    const directory = await mkdtemp(join(tmpdir(), "nx-sprout-config-"));
    try {
      await Bun.write(
        join(directory, ".nx-sprout.json"),
        JSON.stringify({
          generatorAllowlist: ["@nx/angular:*"],
          dryRunOnChange: false,
          dryRunDelayMs: 700,
          showInternalOptions: true,
        }),
      );

      const config = await loadNxSproutConfig(directory);
      expect(config.generatorAllowlist).toEqual(["@nx/angular:*"]);
      expect(config.generatorBlocklist).toEqual([]);
      expect(config.dryRunOnChange).toBe(false);
      expect(config.dryRunDelayMs).toBe(700);
      expect(config.showInternalOptions).toBe(true);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
