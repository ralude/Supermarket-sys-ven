import type { ExecutionContext } from '../execution-context.js';

export interface AuthorizationService {
  authorize(context: ExecutionContext, permission: string): Promise<boolean>;
}
