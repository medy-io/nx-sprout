import type { NxSproutConfig } from "../interfaces/nx-sprout-config.interface.ts";

export const DEFAULT_NX_SPROUT_CONFIG: Readonly<NxSproutConfig> = {
  generatorAllowlist: [],
  generatorBlocklist: [],
  dryRunOnChange: true,
  dryRunDelayMs: 350,
  showInternalOptions: false,
};
