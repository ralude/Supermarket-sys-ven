import { buildApp } from './app.ts';

const host = process.env.SERVER_HOST ?? '127.0.0.1';
const port = Number.parseInt(process.env.SERVER_PORT ?? '3000', 10);
const app = buildApp();
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
  process.exitCode = 1;
}
