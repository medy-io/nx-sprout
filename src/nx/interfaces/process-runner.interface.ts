import type { ProcessResult } from "./process-result.interface.ts";

export interface ProcessRunner {
  cancel(): void;
  run(args: string[]): Promise<ProcessResult>;
}
