import { generatorFields } from "../domain/generator.ts";
import type { GeneratorField } from "../domain/interfaces/generator-field.interface.ts";
import type { GeneratorValue } from "../domain/types/generator-value.type.ts";
import type { GeneratorCommand } from "./interfaces/generator-command.interface.ts";

export function generatorArguments(command: GeneratorCommand): string[] {
  const fields = generatorFields(command.generator.schema);
  const positional = fields
    .filter((field) => field.positionalIndex !== undefined)
    .sort((left, right) => left.positionalIndex! - right.positionalIndex!);
  const positionalNames = new Set(positional.map((field) => field.name));
  const args = ["generate", command.generator.id];

  for (const field of positional) {
    const value = command.values[field.name];
    if (value !== undefined && value !== null && value !== "") {
      args.push(serializeScalar(value));
    }
  }

  for (const field of fields) {
    if (positionalNames.has(field.name)) continue;
    appendOption(args, field, command.values[field.name]);
  }

  if (command.dryRun) args.push("--dry-run");
  args.push("--no-interactive");
  return args;
}

export function displayCommand(executable: string, args: string[]): string {
  return [executable, ...args].map(shellDisplayToken).join(" ");
}

function appendOption(
  args: string[],
  field: GeneratorField,
  value: GeneratorValue | undefined,
): void {
  if (value === undefined || value === null || value === "") return;

  const optionName = `--${field.name}`;
  if (typeof value === "boolean") {
    args.push(value ? optionName : `--no-${field.name}`);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) args.push(optionName, serializeScalar(item));
    return;
  }

  args.push(optionName, serializeScalar(value));
}

function serializeScalar(value: GeneratorValue): string {
  if (Array.isArray(value)) return value.map(serializeScalar).join(",");
  if (typeof value === "object" && value !== null) return JSON.stringify(value);
  return String(value);
}

function shellDisplayToken(token: string): string {
  return /^[A-Za-z0-9_./:@=-]+$/.test(token)
    ? token
    : `'${token.replaceAll("'", `'\\''`)}'`;
}
