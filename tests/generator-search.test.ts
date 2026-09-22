import { describe, expect, test } from "bun:test";
import { searchGenerators } from "../src/domain/generator-search.ts";
import type { GeneratorDescriptor } from "../src/domain/interfaces/generator-descriptor.interface.ts";

function generator(
  id: string,
  description: string,
  aliases: string[] = [],
): GeneratorDescriptor {
  const [collection = "", name = ""] = id.split(":");
  return {
    id,
    collection,
    name,
    aliases,
    description,
    schemaPath: "",
    schema: { type: "object" },
  };
}

const generators = [
  generator("@nx/angular:library", "Create an Angular library", ["lib"]),
  generator("@nx/angular:component", "Create an Angular component", ["c"]),
  generator("@nx/js:library", "Create a JavaScript library", ["lib"]),
];

describe("generator search", () => {
  test("ranks exact names and aliases above broader matches", () => {
    expect(searchGenerators(generators, "component").map((item) => item.id)).toEqual([
      "@nx/angular:component",
    ]);
    expect(searchGenerators(generators, "c")[0]?.id).toBe("@nx/angular:component");
  });

  test("supports multiple tokens and subsequence matching", () => {
    expect(searchGenerators(generators, "angular lib").map((item) => item.id)).toEqual([
      "@nx/angular:library",
    ]);
    expect(searchGenerators(generators, "ng cmp").map((item) => item.id)).toEqual([
      "@nx/angular:component",
    ]);
  });
});
