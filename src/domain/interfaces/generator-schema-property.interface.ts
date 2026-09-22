import type { GeneratorPrompt } from "../types/generator-prompt.type.ts";
import type { GeneratorValue } from "../types/generator-value.type.ts";

export interface GeneratorSchemaProperty {
  type?: string | string[];
  description?: string;
  default?: GeneratorValue;
  enum?: GeneratorValue[];
  const?: GeneratorValue;
  items?: GeneratorSchemaProperty;
  oneOf?: GeneratorSchemaProperty[];
  anyOf?: GeneratorSchemaProperty[];
  allOf?: GeneratorSchemaProperty[];
  properties?: Record<string, GeneratorSchemaProperty>;
  required?: string[];
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  $default?: {
    $source?: "argv" | "projectName" | "workingDirectory" | "unparsed";
    index?: number;
  };
  aliases?: string[];
  "x-prompt"?: GeneratorPrompt;
  "x-priority"?: "important" | "internal" | string;
  "x-deprecated"?: boolean | string;
  "x-dropdown"?: "projects" | string;
  "x-hint"?: string;
  "x-completion-type"?: string;
  "x-completion-glob"?: string;
}
