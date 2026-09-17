import type { ReporterPaths, ScanResult } from './model.js';
/** Renders concise console output suitable for terminals and CI logs. */
export declare function renderConsole(result: ScanResult): string;
/** Builds the stable JSON report contract. */
export declare function createJsonReport(result: ScanResult): object;
/** Builds SARIF 2.1.0 for GitHub code scanning and compatible tooling. */
export declare function createSarifReport(result: ScanResult): object;
/** Creates a self-contained accessible report with severity and suppression context. */
export declare function createHtmlReport(result: ScanResult): string;
/** Writes all machine-readable and human-readable reports atomically enough for CI artifact collection. */
export declare function writeReports(result: ScanResult, outputDirectory: string): Promise<ReporterPaths>;
//# sourceMappingURL=reporters.d.ts.map