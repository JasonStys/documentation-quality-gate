import type { Diagnostic, DocumentFacts, ExternalLinkConfiguration } from './model.js';
/** Checks unique HTTP(S) links and creates a diagnostic at every affected source location. */
export declare function evaluateExternalLinks(rootDirectory: string, documents: readonly DocumentFacts[], configuration: ExternalLinkConfiguration, now?: Date): Promise<Diagnostic[]>;
//# sourceMappingURL=external-links.d.ts.map