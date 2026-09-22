import type { GeneratorChoice } from "./interfaces/generator-choice.interface.ts";
import type { GeneratorField } from "./interfaces/generator-field.interface.ts";
import type { GeneratorSchema } from "./interfaces/generator-schema.interface.ts";
import type { GeneratorSchemaProperty } from "./interfaces/generator-schema-property.interface.ts";
import type { GeneratorPrompt } from "./types/generator-prompt.type.ts";
import type { GeneratorValue } from "./types/generator-value.type.ts";

export function generatorFields(schema: GeneratorSchema): GeneratorField[] {
  const required = new Set(schema.required ?? []);
  const fields = Object.entries(schema.properties ?? {}).map(([name, property]) => {
    const priority = fieldPriority(name, property, required);
    const positionalIndex =
      property.$default?.$source === "argv" ? property.$default.index : undefined;

    return {
      name,
      description: property.description ?? promptMessage(property["x-prompt"]) ?? "",
      required: required.has(name),
      priority,
      ...(positionalIndex === undefined ? {} : { positionalIndex }),
      property,
    } satisfies GeneratorField;
  });

  return fields.sort((left, right) => {
    const rank = {
      required: 0,
      important: 1,
      regular: 2,
      deprecated: 3,
      internal: 4,
    } as const;

    return rank[left.priority] - rank[right.priority] || left.name.localeCompare(right.name);
  });
}

export function generatorFieldChoices(
  field: GeneratorField,
  projects: string[],
): GeneratorChoice[] {
  const prompt = field.property["x-prompt"];
  if (typeof prompt === "object" && prompt.items && prompt.items.length > 0) {
    return prompt.items.map((item) =>
      isLabeledPromptItem(item)
        ? {
            label: item.label,
            description: displayValue(item.value),
            value: item.value,
          }
        : { label: displayValue(item), description: "", value: item },
    );
  }

  const schemaChoices = [
    ...(field.property.enum ?? []).map((value) => ({
      label: displayValue(value),
      description: "",
      value,
    })),
    ...(field.property.oneOf ?? []).flatMap((option) => {
      const values = option.const === undefined ? (option.enum ?? []) : [option.const];
      return values.map((value) => ({
        label: displayValue(value),
        description: option.description ?? "",
        value,
      }));
    }),
  ];
  if (schemaChoices.length > 0) return uniqueChoices(schemaChoices);

  if (isProjectField(field)) {
    return projects.map((project) => ({
      label: project,
      description: "Nx project",
      value: project,
    }));
  }

  return [];
}

export function isProjectField(field: GeneratorField): boolean {
  return (
    field.property["x-dropdown"] === "projects" ||
    field.property["x-completion-type"] === "projects" ||
    field.property.$default?.$source === "projectName" ||
    field.name === "project" ||
    field.name === "projectName"
  );
}

export function isMultiselectField(field: GeneratorField): boolean {
  const prompt = field.property["x-prompt"];
  return field.property.type === "array" || (typeof prompt === "object" && prompt.multiselect === true);
}

function uniqueChoices(choices: GeneratorChoice[]): GeneratorChoice[] {
  const seen = new Set<string>();
  return choices.filter((choice) => {
    const key = JSON.stringify(choice.value);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isLabeledPromptItem(
  item: GeneratorValue | { label: string; value: GeneratorValue },
): item is { label: string; value: GeneratorValue } {
  return typeof item === "object" && item !== null && !Array.isArray(item) && "label" in item && "value" in item;
}

function displayValue(value: GeneratorValue): string {
  return typeof value === "object" && value !== null ? JSON.stringify(value) : String(value);
}

function fieldPriority(
  name: string,
  property: GeneratorSchemaProperty,
  required: Set<string>,
): GeneratorField["priority"] {
  if (required.has(name)) return "required";
  if (property["x-priority"] === "important") return "important";
  if (property["x-deprecated"]) return "deprecated";
  if (property["x-priority"] === "internal") return "internal";
  return "regular";
}

function promptMessage(prompt: GeneratorPrompt | undefined): string | undefined {
  return typeof prompt === "string" ? prompt : prompt?.message;
}
