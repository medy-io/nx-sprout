import type { GeneratorDescriptor } from "../../domain/interfaces/generator-descriptor.interface.ts";
import type { NxInvocation } from "../../nx/interfaces/nx-invocation.interface.ts";
import type { ProcessRunner } from "../../nx/interfaces/process-runner.interface.ts";
import type { NxWorkspace } from "../../nx/interfaces/nx-workspace.interface.ts";

export interface NxSproutOptions {
  workspace: NxWorkspace;
  generators: GeneratorDescriptor[];
  projects: string[];
  invocation: NxInvocation;
  runner: ProcessRunner;
  warnings?: string[];
  dryRunOnChange?: boolean;
  dryRunDelayMs?: number;
  showInternalOptions?: boolean;
  onExit?: () => void;
}
