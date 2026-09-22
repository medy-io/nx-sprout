import type { GeneratorValue } from "./generator-value.type.ts";

export type GeneratorPrompt =
  | string
  | {
      message?: string;
      type?: "input" | "list" | "confirmation";
      multiselect?: boolean;
      items?: Array<GeneratorValue | { label: string; value: GeneratorValue }>;
    };

