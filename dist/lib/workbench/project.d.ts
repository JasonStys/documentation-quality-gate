import { z } from 'zod';
import type { Diagnostic, QualityConfiguration } from '../model.js';
export declare const MAX_PROJECT_BYTES: number;
export declare const MAX_DOCUMENT_BYTES: number;
/** Native names are inert relative identifiers, with Windows aliases/devices refused before materialization. */
export declare function portableName(value: string): boolean;
declare const schema: z.ZodObject<{
    schema: z.ZodLiteral<1>;
    title: z.ZodString;
    documents: z.ZodArray<z.ZodObject<{
        path: z.ZodString;
        text: z.ZodString;
        selected: z.ZodDefault<z.ZodBoolean>;
    }, z.core.$strict>>;
    attachments: z.ZodDefault<z.ZodArray<z.ZodObject<{
        path: z.ZodString;
        base64: z.ZodString;
    }, z.core.$strict>>>;
    policy: z.ZodObject<{
        failOn: z.ZodDefault<z.ZodEnum<{
            none: "none";
            notice: "notice";
            warning: "warning";
            error: "error";
        }>>;
        requiredMetadata: z.ZodDefault<z.ZodArray<z.ZodString>>;
        suppressions: z.ZodDefault<z.ZodArray<z.ZodObject<{
            ruleId: z.ZodString;
            path: z.ZodOptional<z.ZodString>;
            line: z.ZodOptional<z.ZodNumber>;
            rationale: z.ZodString;
            expires: z.ZodOptional<z.ZodISODate>;
        }, z.core.$strict>>>;
    }, z.core.$strict>;
    baseline: z.ZodDefault<z.ZodNullable<z.ZodObject<{
        version: z.ZodLiteral<1>;
        generatedAt: z.ZodISODateTime;
        entries: z.ZodArray<z.ZodObject<{
            fingerprint: z.ZodString;
            ruleId: z.ZodString;
            path: z.ZodString;
            line: z.ZodNumber;
        }, z.core.$strict>>;
    }, z.core.$strict>>>;
}, z.core.$strict>;
export type NativeProject = z.infer<typeof schema>;
/** Parse data only; JSON syntax and repeated keys are both rejected before a saved project can change. */
export declare function parseNativeProject(source: string): NativeProject;
/** Store/export one constant explicit shape, without dropping invalid input or overwriting existing author files. */
export declare function serializeNativeProject(project: NativeProject): string;
/** Revision identity includes text, selections, policy, inert bytes and retained debt; it is not a signature. */
export declare function projectFingerprint(project: NativeProject): string;
/** Exact safe selected names replace filesystem globs; excluded/removed debt remains unexamined in the original engine. */
export declare function effectiveConfiguration(project: NativeProject): QualityConfiguration;
/** Materialize only bounded project data inside a separately owned snapshot; no host source directory is an input. */
export declare function projectFiles(project: NativeProject): ReadonlyMap<string, string | Buffer>;
/** Exact source navigation refuses stale editor/policy revisions; policy findings retain their generated source context. */
export declare function diagnosticSource(project: NativeProject, analyzedFingerprint: string, diagnostic: Diagnostic): {
    text: string;
    line: number;
    column: number;
} | null;
/** Prepared material is data inside the full editor; both documents and policy remain editable. */
export declare function preparedProject(): NativeProject;
export {};
//# sourceMappingURL=project.d.ts.map