import type { GeneratorValue } from "../types/generator-value.type.ts";

export interface GeneratorChoice {
  label: string;
  description: string;
  value: GeneratorValue;
}
