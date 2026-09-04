import { problemDetailsSchema, type HttpContractV1 } from './common.contracts.js';

export type LoginRequest = { readonly operatorCode: string; readonly pin: string };
export type SessionResponse = {
  readonly actorId: string;
  readonly displayName: string;
  readonly roleCodes: readonly string[];
  readonly idleExpiresAt: string;
  readonly absoluteExpiresAt: string;
};

export const loginContract = {
  method: 'POST', path: '/api/v1/auth/session', permission: null, idempotency: 'NONE',
  schema: {
    body: {
      type: 'object', additionalProperties: false, required: ['operatorCode', 'pin'],
      properties: {
        operatorCode: { type: 'string', minLength: 1, maxLength: 64 },
        pin: { type: 'string', pattern: '^[0-9]{6,12}$' }
      }
    },
    response: {
      200: {
        type: 'object', additionalProperties: false,
        required: ['actorId', 'displayName', 'roleCodes', 'idleExpiresAt', 'absoluteExpiresAt'],
        properties: {
          actorId: { type: 'string' }, displayName: { type: 'string' },
          roleCodes: { type: 'array', items: { type: 'string' } },
          idleExpiresAt: { type: 'string' }, absoluteExpiresAt: { type: 'string' }
        }
      },
      400: problemDetailsSchema,
      401: problemDetailsSchema
    }
  },
  errorCodes: ['HTTP_VALIDATION_FAILED', 'AUTHENTICATION_FAILED']
} as const satisfies HttpContractV1;

export const currentSessionContract = {
  method: 'GET', path: '/api/v1/auth/session', permission: null, idempotency: 'NONE',
  schema: { response: { 200: loginContract.schema.response[200], 401: problemDetailsSchema } },
  errorCodes: ['UNAUTHORIZED']
} as const satisfies HttpContractV1;

export const logoutContract = {
  method: 'DELETE', path: '/api/v1/auth/session', permission: null, idempotency: 'NONE',
  schema: { response: { 204: { type: 'null' }, 401: problemDetailsSchema } },
  errorCodes: ['UNAUTHORIZED']
} as const satisfies HttpContractV1;

