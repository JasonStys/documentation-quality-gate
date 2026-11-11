import type { ScanResult } from '../model.js';
import type { NativeProject } from './project.js';
export interface NativeAnalysis {
    readonly schema: 1;
    readonly projectSha256: string;
    readonly reviewedAt: string;
    readonly reviewSha256: string;
    readonly selectedDocuments: number;
    readonly status: 'empty-selection' | 'findings' | 'debt-review' | 'clear';
    readonly summary: ScanResult['summary'];
    readonly failed: boolean;
    readonly diagnostics: ScanResult['diagnostics'];
    readonly baselineReview: ScanResult['baselineReview'];
    readonly reports: {
        readonly json: string;
        readonly sarif: string;
        readonly html: string;
    };
}
/** Run the complete original engine on this explicit corpus, without Git discovery or external-link fetches. */
export declare function analyzeProject(project: NativeProject, snapshotDirectory: string, now?: Date): Promise<NativeAnalysis>;
/** Recompute actual decisions before an explicit baseline refresh; never accept findings the user did not review. */
export declare function acceptReviewedBaseline(project: NativeProject, snapshotDirectory: string, reviewSha256: string, now?: Date): Promise<NativeProject>;
//# sourceMappingURL=analysis.d.ts.map