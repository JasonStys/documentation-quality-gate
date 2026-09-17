/**
 * @file Shared quality-gate domain model.
 * @description Defines configuration, parsed-document facts, diagnostics, and report contracts.
 * @remarks Key declarations are listed in source order; verified locations live in docs/code-map.md.
 */
export declare const SEVERITY_ORDER: {
    readonly none: 0;
    readonly notice: 1;
    readonly warning: 2;
    readonly error: 3;
};
export type Severity = Exclude<keyof typeof SEVERITY_ORDER, 'none'>;
export type FailureThreshold = keyof typeof SEVERITY_ORDER;
export interface SourceLocation {
    readonly line: number;
    readonly column: number;
    readonly endLine?: number;
    readonly endColumn?: number;
}
export interface LocatedText {
    readonly text: string;
    readonly location: SourceLocation;
}
export interface HeadingFact extends LocatedText {
    readonly depth: number;
    readonly slug: string;
}
export interface ImageFact {
    readonly alt: string | null;
    readonly source: string;
    readonly location: SourceLocation;
}
export interface LinkFact {
    readonly target: string;
    readonly label: string;
    readonly location: SourceLocation;
}
export interface TableFact {
    readonly headerCells: readonly string[];
    readonly location: SourceLocation;
}
export interface CodeBlockFact {
    readonly language: string | null;
    readonly value: string;
    readonly location: SourceLocation;
}
export interface WarningFact {
    readonly value: string;
    readonly fields: ReadonlySet<string>;
    readonly location: SourceLocation;
}
export interface HtmlAccessibilityFacts {
    readonly duplicateIds: readonly LocatedText[];
    readonly htmlLanguage: string | null;
    readonly mainCount: number;
    readonly title: LocatedText | null;
}
export interface DocumentFacts {
    readonly absolutePath: string;
    readonly relativePath: string;
    readonly format: 'markdown' | 'html';
    readonly metadata: Readonly<Record<string, unknown>>;
    readonly metadataLocation: SourceLocation;
    readonly headings: readonly HeadingFact[];
    readonly images: readonly ImageFact[];
    readonly links: readonly LinkFact[];
    readonly tables: readonly TableFact[];
    readonly codeBlocks: readonly CodeBlockFact[];
    readonly warnings: readonly WarningFact[];
    readonly anchors: ReadonlySet<string>;
    readonly html: HtmlAccessibilityFacts | null;
}
export interface Diagnostic {
    readonly ruleId: string;
    readonly severity: Severity;
    readonly message: string;
    readonly remediation: string;
    readonly file: string;
    readonly location: SourceLocation;
    readonly fingerprint: string;
    readonly suppressed: boolean;
    readonly suppressionReason?: string;
}
export interface SuppressionConfiguration {
    readonly ruleId: string;
    readonly path?: string | undefined;
    readonly line?: number | undefined;
    readonly rationale: string;
    readonly expires?: string | undefined;
}
export interface ExternalLinkConfiguration {
    readonly enabled: boolean;
    readonly timeoutMs: number;
    readonly retries: number;
    readonly concurrency: number;
    readonly cacheTtlHours: number;
    readonly allowPrivateHosts: boolean;
}
export interface QualityConfiguration {
    readonly include: readonly string[];
    readonly exclude: readonly string[];
    readonly failOn: FailureThreshold;
    readonly requiredMetadata: readonly string[];
    readonly externalLinks: ExternalLinkConfiguration;
    readonly suppressions: readonly SuppressionConfiguration[];
    readonly baselineFile: string;
}
export interface BaselineEntry {
    readonly fingerprint: string;
    readonly ruleId: string;
    readonly path: string;
    readonly line: number;
}
export interface BaselineFile {
    readonly version: 1;
    readonly generatedAt: string;
    readonly entries: readonly BaselineEntry[];
}
export interface ScanOptions {
    readonly rootDirectory: string;
    readonly paths?: readonly string[] | undefined;
    readonly configPath?: string | undefined;
    readonly changedFrom?: string | undefined;
    readonly failureThreshold?: FailureThreshold | undefined;
    readonly now?: Date | undefined;
}
export interface ScanSummary {
    readonly files: number;
    readonly errors: number;
    readonly warnings: number;
    readonly notices: number;
    readonly suppressed: number;
    readonly durationMs: number;
}
export interface ScanResult {
    readonly rootDirectory: string;
    readonly configuration: QualityConfiguration;
    readonly documents: readonly DocumentFacts[];
    readonly diagnostics: readonly Diagnostic[];
    readonly summary: ScanSummary;
    readonly failed: boolean;
}
export interface ReporterPaths {
    readonly json: string;
    readonly sarif: string;
    readonly html: string;
}
//# sourceMappingURL=model.d.ts.map