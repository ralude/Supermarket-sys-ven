import { problemDetailsSchema, type HttpContractV1 } from './common.contracts.js';

export type CapabilitiesResponse = {
  readonly fiscalMode: 'SIMULATION';
  readonly simulatedReportsEnabled: boolean;
};

export const capabilitiesContract = {
  method: 'GET', path: '/api/v1/system/capabilities', permission: null, idempotency: 'NONE',
  schema: {
    response: {
      200: {
        type: 'object', additionalProperties: false,
        required: ['fiscalMode', 'simulatedReportsEnabled'],
        properties: {
          fiscalMode: { const: 'SIMULATION' }, simulatedReportsEnabled: { type: 'boolean' }
        }
      },
      401: problemDetailsSchema
    }
  },
  errorCodes: ['UNAUTHORIZED']
} as const satisfies HttpContractV1;

