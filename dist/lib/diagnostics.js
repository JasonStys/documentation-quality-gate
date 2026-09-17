/**
 * @file Diagnostic construction helpers.
 * @description Creates stable fingerprints and immutable diagnostics for rules and governance checks.
 * @remarks Key declarations are listed in source order; verified locations live in docs/code-map.md.
 */
import { createHash } from 'node:crypto';
/** Computes a deterministic baseline key without exposing source content. */
export function diagnosticFingerprint(input) {
    return createHash('sha256')
        .update([input.ruleId, input.file, String(input.location.line), input.message].join('\u0000'), 'utf8')
        .digest('hex');
}
/** Adds governance fields to a rule-owned diagnostic payload. */
export function createDiagnostic(input) {
    return {
        ...input,
        fingerprint: diagnosticFingerprint(input),
        suppressed: false,
    };
}
//# sourceMappingURL=diagnostics.js.map