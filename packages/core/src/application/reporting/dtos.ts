export type CashClosureReportInput = {
  readonly from?: Date;
  readonly to?: Date;
  readonly cashRegisterId?: string;
  readonly limit?: number;
};

export type CashClosureBalanceDto = {
  readonly paymentMethodCode: string;
  readonly currencyCode: string;
  readonly expectedMinorUnits: number;
  readonly declaredMinorUnits: number;
  readonly differenceMinorUnits: number;
};

export type CashClosureReportEntryDto = {
  readonly shiftId: string;
  readonly cashRegisterId: string;
  readonly terminalId: string;
  readonly originNodeId: string;
  readonly openedBy: string;
  readonly openedAt: Date;
  readonly closedBy: string | null;
  readonly closedAt: Date | null;
  readonly movementCount: number;
  readonly balances: readonly CashClosureBalanceDto[];
};

export type AuditReportInput = {
  readonly from?: Date;
  readonly to?: Date;
  readonly actorId?: string;
  readonly action?: string;
  readonly entityType?: string;
  readonly limit?: number;
};

export type AuditReportEntryDto = {
  readonly auditId: string;
  readonly actorId: string;
  readonly actorRoleCodes: readonly string[];
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly reason: string;
  readonly terminalId: string;
  readonly originNodeId: string;
  readonly occurredAt: Date;
  readonly correlationId: string;
};

export type FiscalOperationsReportInput = {
  readonly from?: Date;
  readonly to?: Date;
  readonly limit?: number;
};

export type FiscalOperationReportEntryDto = {
  readonly kind: 'DOCUMENT' | 'REPORT';
  readonly id: string;
  readonly referenceId: string | null;
  readonly dayId: string | null;
  readonly operationType: string;
  readonly status: string;
  readonly attempts: number;
  readonly fiscalNumber: string | null;
  readonly lastErrorCode: string | null;
  readonly evidence: Readonly<Record<string, string>> | null;
  readonly requestedAt: Date;
};
