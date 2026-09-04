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

/**
 * Evalúa el campo `permission` de un contrato contra los permisos efectivos de
 * la sesión. `null` exige solo sesión válida; un código simple exige ese
 * permiso; `"a|b"` se satisface con cualquiera de los dos. El servidor sigue
 * siendo la autoridad: este evaluador solo decide qué ofrece la interfaz,
 * nunca sustituye la autorización que el caso de uso vuelve a exigir.
 */
export const isPermissionGranted = (
  required: HttpContractV1['permission'],
  grantedPermissionCodes: readonly string[]
): boolean => {
  if (required === null) return true;
  return required.split('|').some((code) => grantedPermissionCodes.includes(code));
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

