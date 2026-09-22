import type { GeneratorSchemaProperty } from "./generator-schema-property.interface.ts";

export interface GeneratorField {
  name: string;
  description: string;
  required: boolean;
  priority: "required" | "important" | "regular" | "deprecated" | "internal";
  positionalIndex?: number;
  property: GeneratorSchemaProperty;
}
