import type { GeneratorValues } from "../types/generator-values.type.ts";
import type { ValidationResult } from "./validation-result.interface.ts";

export interface GeneratorValidator {
  validate(values: GeneratorValues): ValidationResult;
}
