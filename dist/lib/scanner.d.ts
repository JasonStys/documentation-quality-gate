import type { ScanOptions, ScanResult } from './model.js';
/** Reads one open descriptor with a strict byte cap, even if the file grows. */
export declare function readBoundedDocument(absolutePath: string): Promise<string>;
/** Scans a repository and returns a policy-aware, report-ready result. */
export declare function scanRepository(options: ScanOptions): Promise<ScanResult>;
//# sourceMappingURL=scanner.d.ts.map