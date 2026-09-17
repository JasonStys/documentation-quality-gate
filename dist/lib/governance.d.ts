import type { Diagnostic, QualityConfiguration, ScanResult } from './model.js';
/** Loads and minimally validates a baseline, returning an empty set when it does not exist. */
export declare function loadBaseline(rootDirectory: string, baselineFile: string): Promise<ReadonlySet<string>>;
/** Applies baselines and suppressions and emits errors for expired exceptions. */
export declare function applyGovernance(rootDirectory: string, diagnostics: readonly Diagnostic[], configuration: QualityConfiguration, now?: Date): Promise<Diagnostic[]>;
/** Writes the current unsuppressed findings as an explicit versioned baseline. */
export declare function writeBaselineFile(result: ScanResult, destination?: string): Promise<string>;
//# sourceMappingURL=governance.d.ts.map