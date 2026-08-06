import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from './app.ts';

describe('server health endpoint', () => {
  const runningApps: ReturnType<typeof buildApp>[] = [];

  afterEach(async () => {
    await Promise.all(runningApps.splice(0).map((app) => app.close()));
  });

  it('responds to the technical health check without business routes', async () => {
    const app = buildApp();
    runningApps.push(app);

    const response = await app.inject({
      method: 'GET',
      url: '/health'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });

  it('starts on an ephemeral port and shuts down cleanly', async () => {
    const app = buildApp();
    runningApps.push(app);

    await app.listen({ host: '127.0.0.1', port: 0 });

    const address = app.server.address();
    if (address === null || typeof address === 'string') {
      throw new Error('The server did not expose a TCP address.');
    }

    const response = await fetch(`http://127.0.0.1:${address.port}/health`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 'ok' });

    await app.close();
    runningApps.splice(runningApps.indexOf(app), 1);
    expect(app.server.listening).toBe(false);
  });
});
