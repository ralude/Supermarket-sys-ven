import {
  FiscalDocument,
  type FiscalDocumentRepository,
  type FiscalDocumentRecipient,
  type FiscalDocumentState,
  type FiscalDocumentTransition,
  type FiscalDocumentType
} from '@supermarket/core';
import { InfrastructureError } from '@supermarket/shared';
import { and, eq, inArray } from 'drizzle-orm';
import type { DatabaseHandle } from './connection.js';
import {
  fiscalDocumentLines,
  fiscalDocumentPayments,
  fiscalDocuments,
  fiscalDocumentTransitions
} from './schema.js';
import {
  assertFiscalOperationSnapshot,
  fiscalOperationEvidenceValues,
  restoreFiscalOperationEvidence
} from './fiscal-operation-evidence.js';
import { mapDatabaseError, requireTransaction } from './unit-of-work.js';

const restoreFiscalRecipient = (
  row: typeof fiscalDocuments.$inferSelect
): FiscalDocumentRecipient | null => {
  if (row.recipientCountry === null) return null;
  if (row.recipientType === null || row.recipientValue === null ||
    row.recipientNormalizedValue === null) {
    throw new InfrastructureError(
      'FISCAL_DOCUMENT_CONTENT_CONFLICT',
      'Persisted fiscal recipient snapshot is incomplete.'
    );
  }
  return {
    country: row.recipientCountry,
    type: row.recipientType,
    value: row.recipientValue,
    normalizedValue: row.recipientNormalizedValue,
    name: row.recipientName,
    address: row.recipientAddress
  };
};

const activeStates: FiscalDocumentState[] = ['PENDING', 'PRINTING', 'ERROR', 'RETRYING'];
const recoverableStates: FiscalDocumentState[] = ['PENDING', 'PRINTING', 'ERROR', 'RETRYING'];

export class DrizzleFiscalDocumentRepository implements FiscalDocumentRepository {
  constructor(private readonly handle: DatabaseHandle) {}

  async save(document: FiscalDocument): Promise<void> {
    requireTransaction(this.handle.sqlite);
    try {
      const existing = this.handle.db.select().from(fiscalDocuments)
        .where(eq(fiscalDocuments.id, document.id)).get();
      if (existing) this.assertPersistedTransitionSequence(existing.id, existing.version);
      const transitions = this.newTransitions(
        document.transitions,
        existing?.version ?? 0,
        document.version,
        document.status
      );
      if (!existing) {
        this.handle.db.insert(fiscalDocuments).values(this.documentValues(document)).run();
        this.handle.db.insert(fiscalDocumentLines).values(document.content.lines.map((line, sequence) => ({
          documentId: document.id,
          sequence,
          lineId: line.id,
          description: line.description,
          quantityScaled: line.quantityScaled,
          quantityScale: line.quantityScale,
          unitPriceMinorUnits: line.unitPriceMinorUnits,
          taxRateBasisPoints: line.taxRateBasisPoints,
          totalMinorUnits: line.totalMinorUnits
        }))).run();
        this.handle.db.insert(fiscalDocumentPayments).values(
          document.content.payments.map((payment, sequence) => ({
            documentId: document.id,
            sequence,
            methodCode: payment.methodCode,
            amountMinorUnits: payment.amountMinorUnits
          }))
        ).run();
      } else {
        this.assertPersistedIdentity(existing, document);
        if (document.version <= existing.version) {
          throw new InfrastructureError(
            'DATABASE_CONCURRENCY_CONFLICT',
            'Fiscal document version is stale.'
          );
        }
        const evidence = fiscalOperationEvidenceValues(document.lastEvidence);
        this.handle.db.update(fiscalDocuments).set({
          status: document.status,
          version: document.version,
          attempts: document.attempts,
          fiscalNumber: document.fiscalNumber,
          lastErrorCode: document.lastErrorCode,
          lastDispatchState: evidence.dispatchState,
          lastCommandEffect: evidence.commandEffect,
          lastFiscalCommit: evidence.fiscalCommit,
          lastPrintDelivery: evidence.printDelivery,
          lastFailureRetryable: document.lastFailureRetryable
        }).where(eq(fiscalDocuments.id, document.id)).run();
      }

      if (transitions.length > 0) {
        this.handle.db.insert(fiscalDocumentTransitions).values(transitions.map((transition) => {
          const evidence = fiscalOperationEvidenceValues(transition.evidence);
          return {
            eventId: transition.eventId,
            documentId: document.id,
            aggregateVersion: transition.version,
            fromStatus: transition.from,
            toStatus: transition.to,
            actorId: transition.actorId,
            occurredAt: transition.occurredAt,
            errorCode: transition.errorCode,
            dispatchState: evidence.dispatchState,
            commandEffect: evidence.commandEffect,
            fiscalCommit: evidence.fiscalCommit,
            printDelivery: evidence.printDelivery
          };
        })).run();
      }
    } catch (error) {
      throw mapDatabaseError(error);
    }
  }

  findById(id: string): Promise<FiscalDocument | null> {
    return this.read(() => this.restore(this.handle.db.select().from(fiscalDocuments)
      .where(eq(fiscalDocuments.id, id)).get()));
  }

  findByReference(
    originNodeId: string,
    type: FiscalDocumentType,
    referenceId: string
  ): Promise<FiscalDocument | null> {
    return this.read(() => this.restore(this.handle.db.select().from(fiscalDocuments).where(and(
      eq(fiscalDocuments.originNodeId, originNodeId),
      eq(fiscalDocuments.documentType, type),
      eq(fiscalDocuments.referenceId, referenceId)
    )).get()));
  }

  findByIdempotencyKey(originNodeId: string, key: string): Promise<FiscalDocument | null> {
    return this.read(() => this.restore(this.handle.db.select().from(fiscalDocuments).where(and(
      eq(fiscalDocuments.originNodeId, originNodeId),
      eq(fiscalDocuments.idempotencyKey, key)
    )).get()));
  }

  findActive(): Promise<FiscalDocument | null> {
    return this.read(() => this.restore(this.handle.db.select().from(fiscalDocuments)
      .where(inArray(fiscalDocuments.status, activeStates))
      .orderBy(fiscalDocuments.createdAt, fiscalDocuments.id).get()));
  }

  findRecoverable(): Promise<FiscalDocument[]> {
    return this.read(() => this.handle.db.select().from(fiscalDocuments)
      .where(inArray(fiscalDocuments.status, recoverableStates))
      .orderBy(fiscalDocuments.createdAt, fiscalDocuments.id).all()
      .map((row) => this.restore(row) as FiscalDocument));
  }

  private newTransitions(
    transitions: readonly FiscalDocumentTransition[],
    persistedVersion: number,
    aggregateVersion: number,
    aggregateState: FiscalDocumentState
  ): FiscalDocumentTransition[] {
    const ordered = [...transitions].sort((left, right) => left.version - right.version);
    if (ordered.length !== aggregateVersion || ordered.some(
      ({ version }, index) => version !== index + 1
    ) || ordered.at(-1)?.to !== aggregateState) {
      throw new InfrastructureError(
        'DATABASE_FISCAL_TRANSITION_SEQUENCE_INVALID',
        'Fiscal document transition history contradicts its snapshot.'
      );
    }
    const pending = transitions
      .filter(({ version }) => version > persistedVersion)
      .sort((left, right) => left.version - right.version);
    const expectedCount = aggregateVersion - persistedVersion;
    if (expectedCount < 0 || pending.length !== expectedCount ||
      pending.some(({ version }, index) => version !== persistedVersion + index + 1)) {
      throw new InfrastructureError(
        'DATABASE_FISCAL_TRANSITION_SEQUENCE_INVALID',
        'Fiscal document transition sequence is incomplete.'
      );
    }
    return pending;
  }

  private restore(row: typeof fiscalDocuments.$inferSelect | undefined): FiscalDocument | null {
    if (!row) return null;
    const lines = this.handle.db.select().from(fiscalDocumentLines)
      .where(eq(fiscalDocumentLines.documentId, row.id))
      .orderBy(fiscalDocumentLines.sequence).all();
    const payments = this.handle.db.select().from(fiscalDocumentPayments)
      .where(eq(fiscalDocumentPayments.documentId, row.id))
      .orderBy(fiscalDocumentPayments.sequence).all();
    const transitions = this.handle.db.select().from(fiscalDocumentTransitions)
      .where(eq(fiscalDocumentTransitions.documentId, row.id))
      .orderBy(fiscalDocumentTransitions.aggregateVersion).all();
    this.assertTransitionRows(row.version, row.status as FiscalDocumentState, transitions);
    const lastEvidence = restoreFiscalOperationEvidence({
      dispatchState: row.lastDispatchState,
      commandEffect: row.lastCommandEffect,
      fiscalCommit: row.lastFiscalCommit,
      printDelivery: row.lastPrintDelivery
    });
    assertFiscalOperationSnapshot({
      state: row.status as FiscalDocumentState,
      evidence: lastEvidence,
      referenceNumber: row.fiscalNumber
    });
    return FiscalDocument.restore({
      id: row.id,
      content: {
        referenceId: row.referenceId,
        type: row.documentType as FiscalDocumentType,
        currencyCode: row.currencyCode,
        lines: lines.map((line) => ({
          id: line.lineId,
          description: line.description,
          quantityScaled: line.quantityScaled,
          quantityScale: line.quantityScale,
          unitPriceMinorUnits: line.unitPriceMinorUnits,
          taxRateBasisPoints: line.taxRateBasisPoints,
          totalMinorUnits: line.totalMinorUnits
        })),
        payments: payments.map((payment) => ({
          methodCode: payment.methodCode,
          amountMinorUnits: payment.amountMinorUnits
        })),
        totalMinorUnits: row.totalMinorUnits,
        recipient: restoreFiscalRecipient(row)
      },
      idempotencyKey: row.idempotencyKey,
      requestFingerprint: row.requestFingerprint,
      terminalId: row.terminalId,
      originNodeId: row.originNodeId,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      status: row.status as FiscalDocumentState,
      version: row.version,
      attempts: row.attempts,
      fiscalNumber: row.fiscalNumber,
      lastErrorCode: row.lastErrorCode,
      lastEvidence,
      lastFailureRetryable: row.lastFailureRetryable,
      transitions: transitions.map((transition) => ({
        eventId: transition.eventId,
        version: transition.aggregateVersion,
        from: transition.fromStatus as FiscalDocumentState | null,
        to: transition.toStatus as FiscalDocumentState,
        actorId: transition.actorId,
        occurredAt: transition.occurredAt,
        errorCode: transition.errorCode,
        evidence: restoreFiscalOperationEvidence({
          dispatchState: transition.dispatchState,
          commandEffect: transition.commandEffect,
          fiscalCommit: transition.fiscalCommit,
          printDelivery: transition.printDelivery
        })
      }))
    });
  }

  private documentValues(document: FiscalDocument): typeof fiscalDocuments.$inferInsert {
    const evidence = fiscalOperationEvidenceValues(document.lastEvidence);
    return {
      id: document.id,
      referenceId: document.content.referenceId,
      documentType: document.content.type,
      currencyCode: document.content.currencyCode,
      totalMinorUnits: document.content.totalMinorUnits,
      idempotencyKey: document.idempotencyKey,
      requestFingerprint: document.requestFingerprint,
      terminalId: document.terminalId,
      originNodeId: document.originNodeId,
      createdBy: document.createdBy,
      createdAt: document.createdAt,
      status: document.status,
      version: document.version,
      attempts: document.attempts,
      fiscalNumber: document.fiscalNumber,
      lastErrorCode: document.lastErrorCode,
      recipientCountry: document.content.recipient?.country ?? null,
      recipientType: document.content.recipient?.type ?? null,
      recipientValue: document.content.recipient?.value ?? null,
      recipientNormalizedValue: document.content.recipient?.normalizedValue ?? null,
      recipientName: document.content.recipient?.name ?? null,
      recipientAddress: document.content.recipient?.address ?? null,
      lastDispatchState: evidence.dispatchState,
      lastCommandEffect: evidence.commandEffect,
      lastFiscalCommit: evidence.fiscalCommit,
      lastPrintDelivery: evidence.printDelivery,
      lastFailureRetryable: document.lastFailureRetryable
    };
  }

  private assertPersistedTransitionSequence(documentId: string, version: number): void {
    const transitions = this.handle.db.select({
      aggregateVersion: fiscalDocumentTransitions.aggregateVersion,
      toStatus: fiscalDocumentTransitions.toStatus
    }).from(fiscalDocumentTransitions)
      .where(eq(fiscalDocumentTransitions.documentId, documentId))
      .orderBy(fiscalDocumentTransitions.aggregateVersion).all();
    const document = this.handle.db.select({ status: fiscalDocuments.status })
      .from(fiscalDocuments).where(eq(fiscalDocuments.id, documentId)).get();
    this.assertTransitionRows(
      version,
      document?.status as FiscalDocumentState,
      transitions
    );
  }

  private assertTransitionRows(
    version: number,
    state: FiscalDocumentState,
    transitions: readonly { aggregateVersion: number; toStatus: string }[]
  ): void {
    if (transitions.length !== version || transitions.some(
      ({ aggregateVersion }, index) => aggregateVersion !== index + 1
    ) || transitions.at(-1)?.toStatus !== state) {
      throw new InfrastructureError(
        'DATABASE_FISCAL_TRANSITION_SEQUENCE_INVALID',
        'Persisted fiscal document transition sequence is incomplete.'
      );
    }
  }

  private assertPersistedIdentity(
    row: typeof fiscalDocuments.$inferSelect,
    document: FiscalDocument
  ): void {
    if (row.referenceId !== document.content.referenceId ||
      row.documentType !== document.content.type ||
      row.currencyCode !== document.content.currencyCode ||
      row.totalMinorUnits !== document.content.totalMinorUnits ||
      row.recipientNormalizedValue !== (document.content.recipient?.normalizedValue ?? null) ||
      row.idempotencyKey !== document.idempotencyKey ||
      row.requestFingerprint !== document.requestFingerprint) {
      throw new InfrastructureError(
        'FISCAL_DOCUMENT_CONTENT_CONFLICT',
        'Fiscal document content cannot be changed.'
      );
    }
  }

  private async read<T>(operation: () => T): Promise<T> {
    try { return operation(); } catch (error) { throw mapDatabaseError(error); }
  }
}
