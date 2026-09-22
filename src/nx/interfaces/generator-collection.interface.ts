import type { GeneratorCollectionEntry } from "./generator-collection-entry.interface.ts";

export interface GeneratorCollection {
  generators?: Record<string, GeneratorCollectionEntry>;
  schematics?: Record<string, GeneratorCollectionEntry>;
}
