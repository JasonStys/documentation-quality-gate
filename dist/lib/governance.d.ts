import type { BaselineSnapshot } from './baseline.js';
import type { Diagnostic, QualityConfiguration, ScanResult } from './model.js';
/** Loads a strictly validated baseline; missing files mean no accepted findings. */
export declare function loadBaseline(rootDirectory: string, baselineFile: string): Promise<ReadonlySet<string>>;
/** Applies baselines and suppressions and emits errors for expired exceptions. */
export declare function applyGovernance(rootDirectory: string, diagnostics: readonly Diagnostic[], configuration: QualityConfiguration, now?: Date, snapshot?: BaselineSnapshot): Promise<Diagnostic[]>;
/** Refreshes explicitly reviewed debt atomically without dropping findings outside this scan's scope. */
export declare function writeBaselineFile(result: ScanResult, destination?: string): Promise<string>;
//# sourceMappingURL=governance.d.ts.map