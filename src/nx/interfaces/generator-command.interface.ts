import type { GeneratorDescriptor } from "../../domain/interfaces/generator-descriptor.interface.ts";
import type { GeneratorValue } from "../../domain/types/generator-value.type.ts";

export interface GeneratorCommand {
  generator: GeneratorDescriptor;
  values: Record<string, GeneratorValue | undefined>;
  dryRun: boolean;
}
