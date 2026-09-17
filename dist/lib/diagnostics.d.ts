import type { Diagnostic, Severity, SourceLocation } from './model.js';
export interface DiagnosticInput {
    readonly ruleId: string;
    readonly severity: Severity;
    readonly message: string;
    readonly remediation: string;
    readonly file: string;
    readonly location: SourceLocation;
}
/** Computes a deterministic baseline key without exposing source content. */
export declare function diagnosticFingerprint(input: DiagnosticInput): string;
/** Adds governance fields to a rule-owned diagnostic payload. */
export declare function createDiagnostic(input: DiagnosticInput): Diagnostic;
//# sourceMappingURL=diagnostics.d.ts.map