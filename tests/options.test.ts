import { describe, expect, test } from "bun:test";
import {
  generatorFieldChoices,
  isMultiselectField,
  isProjectField,
} from "../src/domain/generator.ts";
import type { GeneratorDescriptor } from "../src/domain/interfaces/generator-descriptor.interface.ts";
import type { GeneratorField } from "../src/domain/interfaces/generator-field.interface.ts";
import {
  coerceInputValue,
  createGeneratorValidator,
  formatInputValue,
} from "../src/domain/options.ts";

function field(overrides: Partial<GeneratorField> = {}): GeneratorField {
  return {
    name: "value",
    description: "",
    required: false,
    priority: "regular",
    property: { type: "string" },
    ...overrides,
  };
}

describe("generator option modeling", () => {
  test("builds labeled choices from x-prompt metadata", () => {
    const option = field({
      property: {
        type: "string",
        "x-prompt": {
          type: "list",
          message: "Choose a mode",
          items: [
            { label: "Recommended", value: "safe" },
            { label: "Advanced", value: "fast" },
          ],
        },
      },
    });

    expect(generatorFieldChoices(option, [])).toEqual([
      { label: "Recommended", description: "safe", value: "safe" },
      { label: "Advanced", description: "fast", value: "fast" },
    ]);
  });

  test("recognizes implicit project fields and supplies workspace projects", () => {
    const option = field({ name: "projectName" });

    expect(isProjectField(option)).toBe(true);
    expect(generatorFieldChoices(option, ["api", "shop"]).map((choice) => choice.value)).toEqual([
      "api",
      "shop",
    ]);
  });

  test("coerces array, numeric, and object input without accepting partial integers", () => {
    const arrayProperty = { type: "array", items: { type: "integer" } };
    expect(coerceInputValue("1, 2, 3", arrayProperty)).toEqual([1, 2, 3]);
    expect(coerceInputValue("12px", { type: "integer" })).toBe("12px");
    expect(coerceInputValue('{"scope":"shared"}', { type: "object" })).toEqual({
      scope: "shared",
    });
    expect(formatInputValue(["ui", "shared"])).toBe("ui, shared");
    expect(isMultiselectField(field({ property: arrayProperty }))).toBe(true);
  });

  test("reports an invalid third-party schema without throwing", () => {
    const generator: GeneratorDescriptor = {
      id: "fixture:invalid",
      collection: "fixture",
      name: "invalid",
      aliases: [],
      description: "",
      schemaPath: "invalid-schema.json",
      schema: {
        type: "object",
        properties: {
          value: { type: "string", pattern: "[" },
        },
      },
    };

    const result = createGeneratorValidator(generator).validate({ value: "test" });
    expect(result.valid).toBe(false);
    expect(result.messages[0]).toContain("could not be compiled");
  });
});
