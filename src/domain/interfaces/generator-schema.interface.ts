import type { GeneratorSchemaProperty } from "./generator-schema-property.interface.ts";

export interface GeneratorSchema {
  $schema?: string;
  $id?: string;
  title?: string;
  description?: string;
  type?: "object" | string;
  properties?: Record<string, GeneratorSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean;
}
