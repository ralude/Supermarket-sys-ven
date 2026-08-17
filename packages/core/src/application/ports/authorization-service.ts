import type { ExecutionContext } from '../execution-context.js';

/** Contrato mínimo adelantado desde 2.06; la identidad completa sigue pendiente. */
export interface AuthorizationService {
  authorize(context: ExecutionContext, permission: string): Promise<boolean>;
}
