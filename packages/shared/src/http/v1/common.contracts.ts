export type JsonSchema = Readonly<Record<string, unknown>>;

export type HttpContractV1 = {
  readonly method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  readonly path: `/api/v1/${string}`;
  readonly permission: string | null;
  readonly idempotency: 'NONE' | 'OPTIONAL' | 'REQUIRED';
  readonly schema: {
    readonly params?: JsonSchema;
    readonly querystring?: JsonSchema;
    readonly headers?: JsonSchema;
    readonly body?: JsonSchema;
    readonly response: Readonly<Record<number, JsonSchema>>;
  };
  readonly errorCodes: readonly string[];
};

export type ProblemDetails = {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly code: string;
  readonly correlationId: string;
};

export const problemDetailsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['type', 'title', 'status', 'code', 'correlationId'],
  properties: {
    type: { type: 'string' },
    title: { type: 'string' },
    status: { type: 'integer' },
    code: { type: 'string' },
    correlationId: { type: 'string' }
  }
} as const;

