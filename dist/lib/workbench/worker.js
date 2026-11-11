/**
 * @file One owned native task using the genuine offline scanner and baseline refresh.
 * @description The parent supplies a fresh private snapshot and retains this worker until its actual exit.
 * @remarks Only closed project data enters the task; there is no executable, repository or endpoint input.
 * @remarks Functions, parameters, state variables and exact declaration locations: generated docs/code-map.md (pnpm code-map).
 */
import { parentPort, workerData } from 'node:worker_threads';
import { z } from 'zod';
import { analyzeProject, acceptReviewedBaseline } from './analysis.js';
import { parseNativeProject } from './project.js';
const task = z
    .object({
    operation: z.enum(['analyze', 'accept']),
    project: z.unknown(),
    snapshot: z.string().min(1),
    reviewSha256: z
        .string()
        .regex(/^[a-f0-9]{64}$/u)
        .optional(),
})
    .strict();
/** A single completion message is not completion of ownership: the parent also waits for actual worker exit. */
async function run() {
    try {
        const message = task.parse(workerData);
        const project = parseNativeProject(JSON.stringify(message.project));
        const value = message.operation === 'analyze'
            ? await analyzeProject(project, message.snapshot)
            : await acceptReviewedBaseline(project, message.snapshot, message.reviewSha256 ?? '');
        parentPort?.postMessage({ success: true, value });
    }
    catch {
        parentPort?.postMessage({ success: false });
    }
    finally {
        parentPort?.close();
    }
}
void run();
//# sourceMappingURL=worker.js.map