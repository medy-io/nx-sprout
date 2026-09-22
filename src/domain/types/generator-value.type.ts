import type { JsonPrimitive } from "./json-primitive.type.ts";

export type GeneratorValue =
  | JsonPrimitive
  | GeneratorValue[]
  | { [key: string]: GeneratorValue };
