import type { FastifyPluginAsync } from 'fastify';

const healthRoute: FastifyPluginAsync = async (app) => {
  app.get('/health', async () => ({ status: 'ok' as const }));
};

export default healthRoute;
