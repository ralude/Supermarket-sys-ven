import Fastify, { type FastifyInstance } from 'fastify';
import healthRoute from './routes/health.ts';

export const buildApp = (): FastifyInstance => {
  const app = Fastify({ logger: true });

  app.register(healthRoute);

  return app;
};
