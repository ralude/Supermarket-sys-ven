import type { FastifyInstance, FastifySchema } from 'fastify';
import {
  currentSessionContract,
  loginContract,
  logoutContract,
  type LoginRequest,
  type SessionResponse
} from '@supermarket/shared';
import {
  requirePrincipal,
  sendProblem,
  type ServerDependencies
} from '../app.ts';

const responseFrom = (principal: {
  actorId: string; displayName: string; roleCodes: readonly string[];
  permissionCodes: readonly string[];
  idleExpiresAt: Date; absoluteExpiresAt: Date;
}): SessionResponse => ({
  actorId: principal.actorId,
  displayName: principal.displayName,
  roleCodes: principal.roleCodes,
  permissionCodes: principal.permissionCodes,
  idleExpiresAt: principal.idleExpiresAt.toISOString(),
  absoluteExpiresAt: principal.absoluteExpiresAt.toISOString()
});

export const registerAuthRoutes = (app: FastifyInstance, dependencies: ServerDependencies): void => {
  app.post<{ Body: LoginRequest }>(loginContract.path, {
    schema: loginContract.schema as FastifySchema
  }, async (request, reply) => {
    const result = await dependencies.authenticateOperator.execute({
      ...request.body,
      terminalId: dependencies.nodeIdentity.terminalId,
      originNodeId: dependencies.nodeIdentity.originNodeId
    });
    if (!result.ok) {
      return sendProblem(reply, request, 'AUTHENTICATION_FAILED', 'Authentication failed.', 401);
    }
    reply.header(
      'set-cookie',
      `pos_session=${encodeURIComponent(result.value.token)}; HttpOnly; SameSite=Strict; Path=/api/v1; Max-Age=28800`
    );
    return responseFrom(result.value.principal);
  });

  app.get(currentSessionContract.path, {
    schema: currentSessionContract.schema as FastifySchema
  }, async (request, reply) => {
    const principal = await requirePrincipal(request, reply, dependencies);
    return principal ? responseFrom(principal) : undefined;
  });

  app.delete(logoutContract.path, {
    schema: logoutContract.schema as FastifySchema
  }, async (request, reply) => {
    const principal = await requirePrincipal(request, reply, dependencies);
    if (!principal) return;
    const cookie = request.headers.cookie?.split(';').map((part) => part.trim())
      .find((part) => part.startsWith('pos_session='));
    await dependencies.revokeSession.execute(
      cookie ? decodeURIComponent(cookie.slice('pos_session='.length)) : ''
    );
    reply.header('set-cookie', 'pos_session=; HttpOnly; SameSite=Strict; Path=/api/v1; Max-Age=0');
    return reply.code(204).send();
  });
};

