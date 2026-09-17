/**
 * @file External-link integration tests.
 * @description Uses a local HTTP service to verify retries, caching, status classes, and private-host blocking.
 * @remarks Key declarations are listed in source order; verified locations live in docs/code-map.md.
 */
import { createServer } from 'node:http';
import { once } from 'node:events';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { parseConfiguration } from '../../src/config.js';
import { evaluateExternalLinks } from '../../src/external-links.js';
import { parseMarkdownDocument } from '../../src/parsers/markdown.js';
import { createTemporaryRepository, type TemporaryRepository } from '../helpers.js';

let repository: TemporaryRepository | undefined;

afterEach(async () => {
  await repository?.cleanup();
  repository = undefined;
});

describe('external link checking', () => {
  it('retries transient responses, reports broken links, and reuses the cache', async () => {
    repository = await createTemporaryRepository();
    const requests = new Map<string, number>();
    const server = createServer((request, response) => {
      const url = request.url ?? '/';
      requests.set(url, (requests.get(url) ?? 0) + 1);
      if (url === '/ok') {
        response.writeHead(200).end('ok');
      } else if (url === '/flaky' && (requests.get(url) ?? 0) === 1) {
        response.writeHead(503).end('retry');
      } else if (url === '/flaky') {
        response.writeHead(200).end('ok');
      } else {
        response.writeHead(404).end('missing');
      }
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    try {
      const address = server.address();
      if (address === null || typeof address === 'string') {
        throw new Error('Expected a TCP listener.');
      }
      const base = `http://127.0.0.1:${address.port}`;
      const source = `# Links\n[ok](${base}/ok) [missing](${base}/missing) [flaky](${base}/flaky)\n`;
      const document = parseMarkdownDocument(
        path.join(repository.root, 'links.md'),
        'links.md',
        source,
      );
      const configuration = parseConfiguration({
        externalLinks: {
          enabled: true,
          timeoutMs: 1_000,
          retries: 1,
          concurrency: 2,
          cacheTtlHours: 24,
          allowPrivateHosts: true,
        },
      }).externalLinks;
      const first = await evaluateExternalLinks(
        repository.root,
        [document],
        configuration,
      );
      expect(first).toHaveLength(1);
      expect(first[0]?.message).toContain('HTTP 404');
      expect(requests.get('/flaky')).toBe(2);
      const countAfterFirst = [...requests.values()].reduce(
        (sum, value) => sum + value,
        0,
      );
      const second = await evaluateExternalLinks(
        repository.root,
        [document],
        configuration,
      );
      expect(second).toHaveLength(1);
      expect([...requests.values()].reduce((sum, value) => sum + value, 0)).toBe(
        countAfterFirst,
      );
    } finally {
      server.close();
      await once(server, 'close');
    }
  });

  it('blocks private targets unless explicitly allowed', async () => {
    repository = await createTemporaryRepository();
    const document = parseMarkdownDocument(
      path.join(repository.root, 'links.md'),
      'links.md',
      '# Links\n[private](http://127.0.0.1/private)\n',
    );
    const configuration = parseConfiguration({
      externalLinks: { enabled: true, allowPrivateHosts: false },
    }).externalLinks;
    const diagnostics = await evaluateExternalLinks(
      repository.root,
      [document],
      configuration,
    );
    expect(diagnostics[0]).toMatchObject({ ruleId: 'DQ012', severity: 'warning' });
    expect(diagnostics[0]?.message).toMatch(/private|reserved/i);
  });
});
