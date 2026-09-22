import type { ErrorObject, ValidateFunction } from "ajv";
import Ajv2020 from "ajv/dist/2020.js";
import type { GeneratorDescriptor } from "./interfaces/generator-descriptor.interface.ts";
import type { GeneratorSchemaProperty } from "./interfaces/generator-schema-property.interface.ts";
import type { GeneratorValidator } from "./interfaces/generator-validator.interface.ts";
import type { ValidationResult } from "./interfaces/validation-result.interface.ts";
import type { GeneratorValue } from "./types/generator-value.type.ts";
import type { GeneratorValues } from "./types/generator-values.type.ts";

export function initialGeneratorValues(generator: GeneratorDescriptor): GeneratorValues {
  return Object.fromEntries(
    Object.entries(generator.schema.properties ?? {}).flatMap(([name, property]) =>
      property.default === undefined ? [] : [[name, property.default]],
    ),
  );
}

export function coerceInputValue(
  rawValue: string,
  property: GeneratorSchemaProperty,
): GeneratorValue | undefined {
  if (rawValue === "") return undefined;
  const types = Array.isArray(property.type) ? property.type : [property.type].filter(Boolean);

  if (types.includes("array")) {
    const trimmed = rawValue.trim();
    if (trimmed.startsWith("[")) {
      const parsed = parseJsonValue(trimmed);
      if (Array.isArray(parsed)) return parsed;
    }

    return rawValue
      .split(",")
      .map((item) => coerceInputValue(item.trim(), property.items ?? { type: "string" }))
      .filter((value): value is GeneratorValue => value !== undefined);
  }

  if (types.includes("object")) return parseJsonValue(rawValue);

  if (types.includes("integer")) {
    const value = Number(rawValue);
    return Number.isInteger(value) ? value : rawValue;
  }
  if (types.includes("number")) {
    const value = Number(rawValue);
    return Number.isNaN(value) ? rawValue : value;
  }
  if (types.includes("boolean")) {
    if (rawValue === "true") return true;
    if (rawValue === "false") return false;
  }
  if (types.includes("null") && rawValue === "null") return null;

  return rawValue;
}

export function formatInputValue(value: GeneratorValue | undefined): string {
  if (value === undefined) return "";
  if (Array.isArray(value)) return value.map(formatInputValue).join(", ");
  if (typeof value === "object" && value !== null) return JSON.stringify(value);
  return String(value);
}

export function createGeneratorValidator(generator: GeneratorDescriptor): GeneratorValidator {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const schema = { ...generator.schema };
  delete schema.$schema;
  let validate: ValidateFunction<GeneratorValues>;
  try {
    validate = ajv.compile(schema as object) as ValidateFunction<GeneratorValues>;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      validate: () => ({
        valid: false,
        messages: [`Generator schema could not be compiled: ${message}`],
      }),
    };
  }

  return {
    validate(values: GeneratorValues): ValidationResult {
      const populatedValues = Object.fromEntries(
        Object.entries(values).filter(([, value]) => value !== undefined && value !== ""),
      );
      const valid = validate(populatedValues);
      return {
        valid: Boolean(valid),
        messages: valid ? [] : (validate.errors ?? []).map(validationMessage),
      };
    },
  };
}

function parseJsonValue(rawValue: string): GeneratorValue {
  try {
    const parsed = JSON.parse(rawValue) as unknown;
    if (isGeneratorValue(parsed)) return parsed;
  } catch {
    // Return the original input so AJV can report the expected schema type.
  }
  return rawValue;
}

function isGeneratorValue(value: unknown): value is GeneratorValue {
  if (value === null || ["boolean", "number", "string"].includes(typeof value)) return true;
  if (Array.isArray(value)) return value.every(isGeneratorValue);
  return typeof value === "object" && Object.values(value).every(isGeneratorValue);
}

function validationMessage(error: ErrorObject): string {
  const field = error.instancePath.replace(/^\//, "") || String(error.params.missingProperty ?? "options");
  return `${field}: ${error.message ?? "is invalid"}`;
}
