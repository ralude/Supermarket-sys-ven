import { buildApp } from './app.ts';
import { loadNodeIdentity } from '@supermarket/driver-security';
import { createSecurityRuntime } from './runtime.ts';

const host = process.env.SERVER_HOST ?? '127.0.0.1';
const port = Number.parseInt(process.env.SERVER_PORT ?? '3000', 10);
const nodeIdentity = loadNodeIdentity(process.env.NODE_IDENTITY_PATH);
const runtime = createSecurityRuntime(
  process.env.DATABASE_PATH ?? 'supermarket-node.sqlite',
  nodeIdentity,
  {
    ...(process.env.FISCAL_EXECUTION_TARGET
      ? { executionTarget: process.env.FISCAL_EXECUTION_TARGET }
      : {}),
    ...(process.env.FISCAL_SIMULATED_REPORT_CONSENT
      ? { reportConsent: process.env.FISCAL_SIMULATED_REPORT_CONSENT }
      : {})
  }
);
const app = buildApp(runtime.dependencies);
let shuttingDown = false;

const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  app.log.info({ signal }, 'Shutting down server');

  try {
    await app.close();
  } catch (error) {
    app.log.error({ err: error }, 'Server shutdown failed');
    process.exitCode = 1;
  }
};

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

try {
  await app.listen({ host, port });
  app.log.info({ host, port }, 'Server listening');
} catch (error) {
  app.log.error({ err: error }, 'Server startup failed');
  await app.close();
  process.exitCode = 1;
}
