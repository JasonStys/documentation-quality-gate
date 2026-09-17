import type { Diagnostic, DocumentFacts, QualityConfiguration } from './model.js';
export interface RuleDefinition {
    readonly id: string;
    readonly title: string;
    readonly defaultSeverity: 'error' | 'warning' | 'notice';
    readonly description: string;
}
export declare const RULES: readonly RuleDefinition[];
/** Evaluates all deterministic built-in rules except optional network checks. */
export declare function evaluateRules(rootDirectory: string, documents: readonly DocumentFacts[], configuration: QualityConfiguration): Promise<Diagnostic[]>;
//# sourceMappingURL=rules.d.ts.map