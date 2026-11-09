import type { BaselineEntry, BaselineReview, Diagnostic, QualityConfiguration, ScanResult } from './model.js';
export interface BaselineSnapshot {
    readonly sha256: string | null;
    readonly entries: readonly BaselineEntry[];
}
/** Read one descriptor with a hard byte/entry limit; malformed entries never silently disappear. */
export declare function loadBaselineSnapshot(root: string, destination: string): Promise<BaselineSnapshot>;
/** Operational read/parse errors and expired governance exceptions cannot become accepted debt. */
export declare function baselineEligible(diagnostic: Diagnostic): boolean;
/** Describe only what this successful scan established; absent/excluded/deleted paths remain unexamined. */
export declare function reviewBaseline(snapshot: BaselineSnapshot, diagnostics: readonly Diagnostic[], scannedFiles: readonly string[], configuration: QualityConfiguration): BaselineReview;
/** Explicit refresh: retain unexamined/persistent debt, accept new findings, and reject stale/concurrent writes. */
export declare function refreshBaseline(result: ScanResult, destination: string): Promise<string>;
//# sourceMappingURL=baseline.d.ts.map