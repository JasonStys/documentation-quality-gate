/**
 * @file Bounded external-link checker.
 * @description Performs opt-in cached HTTP checks with retries, concurrency limits, and private-host protection.
 * @remarks Key declarations are listed in source order; verified locations live in docs/code-map.md.
 */
import { isIP } from 'node:net';
import { lookup } from 'node:dns/promises';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createDiagnostic } from './diagnostics.js';
import type {
  Diagnostic,
  DocumentFacts,
  ExternalLinkConfiguration,
  LinkFact,
} from './model.js';

interface CachedLinkResult {
  readonly checkedAt: string;
  readonly state: 'ok' | 'broken' | 'transient' | 'blocked';
  readonly message: string;
  readonly statusCode?: number;
}

interface LinkCache {
  readonly version: 1;
  readonly entries: Readonly<Record<string, CachedLinkResult>>;
}

interface PendingLink {
  readonly document: DocumentFacts;
  readonly link: LinkFact;
  readonly url: string;
}

/** Detects private, loopback, link-local, multicast, and unspecified IP addresses. */
function isPrivateAddress(address: string): boolean {
  if (
    address === '::' ||
    address === '::1' ||
    address.toLowerCase().startsWith('fe80:')
  ) {
    return true;
  }
  if (address.toLowerCase().startsWith('fc') || address.toLowerCase().startsWith('fd')) {
    return true;
  }
  const mapped = address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i)?.[1];
  const ipv4 = mapped ?? (isIP(address) === 4 ? address : null);
  if (ipv4 === null) {
    return false;
  }
  const octets = ipv4.split('.').map(Number);
  const [first = 0, second = 0] = octets;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    first >= 224
  );
}

/** Verifies that a link cannot directly target credentials or a private host by default. */
async function validateNetworkTarget(
  url: URL,
  allowPrivateHosts: boolean,
): Promise<string | null> {
  if (url.username.length > 0 || url.password.length > 0) {
    return 'URLs containing embedded credentials are not checked.';
  }
  if (allowPrivateHosts) {
    return null;
  }
  const hostname = url.hostname.toLowerCase();
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local')
  ) {
    return 'Private and local hostnames are blocked.';
  }
  try {
    const addresses = await lookup(hostname, { all: true, verbatim: true });
    if (
      addresses.length === 0 ||
      addresses.some((item) => isPrivateAddress(item.address))
    ) {
      return 'The hostname resolves to a private or reserved address.';
    }
  } catch (error: unknown) {
    return `DNS lookup failed: ${error instanceof Error ? error.message : 'unknown error'}`;
  }
  return null;
}

/** Loads the network-result cache, ignoring absent or stale-schema files. */
async function loadCache(cachePath: string): Promise<Record<string, CachedLinkResult>> {
  try {
    const parsed = JSON.parse(await readFile(cachePath, 'utf8')) as Partial<LinkCache>;
    return parsed.version === 1 && parsed.entries !== undefined
      ? { ...parsed.entries }
      : {};
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {};
    }
    return {};
  }
}

/** Executes one bounded HTTP request and classifies definite versus transient failures. */
async function requestLink(url: URL, timeoutMs: number): Promise<CachedLinkResult> {
  const checkedAt = new Date().toISOString();
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Range: 'bytes=0-0', 'User-Agent': 'documentation-quality-gate/1.0' },
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
    });
    await response.body?.cancel();
    if (response.ok || response.status === 206) {
      return {
        checkedAt,
        state: 'ok',
        message: 'Link responded successfully.',
        statusCode: response.status,
      };
    }
    if (
      response.status === 408 ||
      response.status === 425 ||
      response.status === 429 ||
      response.status >= 500
    ) {
      return {
        checkedAt,
        state: 'transient',
        message: `Remote service returned transient HTTP ${response.status}.`,
        statusCode: response.status,
      };
    }
    return {
      checkedAt,
      state: 'broken',
      message: `Remote service returned HTTP ${response.status}.`,
      statusCode: response.status,
    };
  } catch (error: unknown) {
    return {
      checkedAt,
      state: 'transient',
      message: `Network check failed: ${error instanceof Error ? error.message : 'unknown error'}`,
    };
  }
}

/** Retries only transient results with a small bounded backoff. */
async function checkWithRetry(
  url: URL,
  configuration: ExternalLinkConfiguration,
): Promise<CachedLinkResult> {
  const blocked = await validateNetworkTarget(url, configuration.allowPrivateHosts);
  if (blocked !== null) {
    return { checkedAt: new Date().toISOString(), state: 'blocked', message: blocked };
  }
  let result = await requestLink(url, configuration.timeoutMs);
  for (
    let attempt = 0;
    attempt < configuration.retries && result.state === 'transient';
    attempt += 1
  ) {
    await new Promise((resolve) => setTimeout(resolve, 100 * 2 ** attempt));
    result = await requestLink(url, configuration.timeoutMs);
  }
  return result;
}

/** Maps work with a fixed number of in-flight promises. */
async function runBounded<T>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const runners = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        const item = items[index];
        if (item !== undefined) {
          await worker(item);
        }
      }
    },
  );
  await Promise.all(runners);
}

/** Checks unique HTTP(S) links and creates a diagnostic at every affected source location. */
export async function evaluateExternalLinks(
  rootDirectory: string,
  documents: readonly DocumentFacts[],
  configuration: ExternalLinkConfiguration,
  now = new Date(),
): Promise<Diagnostic[]> {
  if (!configuration.enabled) {
    return [];
  }
  const pending = documents.flatMap((document) =>
    document.links
      .filter((link) => /^https?:\/\//i.test(link.target))
      .map((link) => ({ document, link, url: link.target })),
  );
  const byUrl = new Map<string, PendingLink[]>();
  for (const item of pending) {
    const grouped = byUrl.get(item.url) ?? [];
    grouped.push(item);
    byUrl.set(item.url, grouped);
  }
  const cachePath = path.resolve(rootDirectory, '.docquality-cache.json');
  const cache = await loadCache(cachePath);
  const ttlMs = configuration.cacheTtlHours * 60 * 60 * 1_000;
  const results = new Map<string, CachedLinkResult>();
  const urls = [...byUrl.keys()].sort();

  await runBounded(urls, configuration.concurrency, async (rawUrl) => {
    const cached = cache[rawUrl];
    if (cached !== undefined && now.getTime() - Date.parse(cached.checkedAt) <= ttlMs) {
      results.set(rawUrl, cached);
      return;
    }
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      results.set(rawUrl, {
        checkedAt: now.toISOString(),
        state: 'broken',
        message: 'URL is not syntactically valid.',
      });
      return;
    }
    const result = await checkWithRetry(parsed, configuration);
    results.set(rawUrl, result);
    cache[rawUrl] = result;
  });

  await writeFile(
    cachePath,
    `${JSON.stringify({ version: 1, entries: cache } satisfies LinkCache, null, 2)}\n`,
    'utf8',
  );

  const diagnostics: Diagnostic[] = [];
  for (const [url, usages] of byUrl) {
    const result = results.get(url);
    if (result === undefined || result.state === 'ok') {
      continue;
    }
    for (const usage of usages) {
      diagnostics.push(
        createDiagnostic({
          ruleId: 'DQ012',
          severity: result.state === 'transient' ? 'notice' : 'warning',
          message: `${result.message} ${url}`,
          remediation:
            result.state === 'blocked'
              ? 'Keep private-host checks disabled for untrusted content or explicitly allow them in a trusted environment.'
              : 'Confirm the destination, retry transient failures, or replace the link with a stable source.',
          file: usage.document.relativePath,
          location: usage.link.location,
        }),
      );
    }
  }
  return diagnostics;
}
