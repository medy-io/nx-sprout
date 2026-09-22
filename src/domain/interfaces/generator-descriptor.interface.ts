import type { GeneratorSchema } from "./generator-schema.interface.ts";

export interface GeneratorDescriptor {
  id: string;
  collection: string;
  name: string;
  aliases: string[];
  description: string;
  schemaPath: string;
  schema: GeneratorSchema;
}
