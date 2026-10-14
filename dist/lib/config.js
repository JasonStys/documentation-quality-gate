/**
 * @file Configuration loader and validator.
 * @description Parses JSON configuration, applies secure defaults, and reports precise schema errors.
 * @remarks Key declarations are listed in source order; verified locations live in docs/code-map.md.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
const severitySchema = z.enum(['error', 'warning', 'notice', 'none']);
/** Limits configured glob work before invoking the glob parser; value is data. */
function boundedGlob(value) {
    if (value.length > 4096)
        return false;
    const stack = [];
    for (const character of value) {
        if ('{[('.includes(character)) {
            stack.push(character);
            if (stack.length > 32)
                return false;
        }
        else {
            const closing = '}])'.indexOf(character);
            if (closing >= 0 && stack.at(-1) === '{[('[closing])
                stack.pop();
        }
    }
    return true;
}
const globSchema = z
    .string()
    .trim()
    .min(1)
    .max(4096)
    .refine(boundedGlob, 'Glob nesting exceeds the supported depth of 32');
const externalLinkSchema = z
    .object({
    enabled: z.boolean().default(false),
    timeoutMs: z.number().int().min(250).max(30_000).default(4_000),
    retries: z.number().int().min(0).max(3).default(1),
    concurrency: z.number().int().min(1).max(16).default(4),
    cacheTtlHours: z.number().min(0).max(720).default(24),
    allowPrivateHosts: z.boolean().default(false),
})
    .strict()
    .default({
    enabled: false,
    timeoutMs: 4_000,
    retries: 1,
    concurrency: 4,
    cacheTtlHours: 24,
    allowPrivateHosts: false,
});
const suppressionSchema = z
    .object({
    ruleId: z.string().trim().min(1),
    path: z.string().trim().min(1).optional(),
    line: z.number().int().positive().optional(),
    rationale: z.string().trim().min(8),
    expires: z.iso.date().optional(),
})
    .strict();
const configurationSchema = z
    .object({
    $schema: z.string().optional(),
    include: z.array(globSchema).min(1).max(128).default(['**/*.{md,html}']),
    exclude: z
        .array(globSchema)
        .max(128)
        .default(['node_modules/**', 'dist/**', 'coverage/**']),
    failOn: severitySchema.default('error'),
    requiredMetadata: z.array(z.string().trim().min(1)).default(['title']),
    externalLinks: externalLinkSchema,
    suppressions: z.array(suppressionSchema).default([]),
    baselineFile: z.string().trim().min(1).default('.docquality-baseline.json'),
})
    .strict();
/** Formats a Zod validation failure into a stable, readable configuration error. */
function formatValidationError(error) {
    return error.issues
        .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
        .join('; ');
}
/** Validates an already-parsed configuration value and applies defaults. */
export function parseConfiguration(value) {
    const result = configurationSchema.safeParse(value);
    if (!result.success) {
        throw new Error(`Invalid documentation quality configuration: ${formatValidationError(result.error)}`);
    }
    return result.data;
}
/** Loads configuration relative to the scan root, falling back to secure defaults if absent. */
export async function loadConfiguration(rootDirectory, configPath = '.docquality.json') {
    const absolutePath = path.resolve(rootDirectory, configPath);
    try {
        const source = await readFile(absolutePath, 'utf8');
        return parseConfiguration(JSON.parse(source));
    }
    catch (error) {
        if (error instanceof SyntaxError) {
            throw new Error(`Configuration is not valid JSON: ${absolutePath}`, {
                cause: error,
            });
        }
        if (error.code === 'ENOENT') {
            return parseConfiguration({});
        }
        throw error;
    }
}
//# sourceMappingURL=config.js.map