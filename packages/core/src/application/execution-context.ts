export type ExecutionContext = {
  actorId: string;
  terminalId: string;
  originNodeId: string;
  correlationId: string;
  idempotencyKey?: string;
  actorRoleCodes?: readonly string[];
};
