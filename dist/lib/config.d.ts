import type { QualityConfiguration } from './model.js';
/** Validates an already-parsed configuration value and applies defaults. */
export declare function parseConfiguration(value: unknown): QualityConfiguration;
/** Loads configuration relative to the scan root, falling back to secure defaults if absent. */
export declare function loadConfiguration(rootDirectory: string, configPath?: string): Promise<QualityConfiguration>;
//# sourceMappingURL=config.d.ts.map