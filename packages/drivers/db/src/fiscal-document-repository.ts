import {
  FiscalDocument,
  type FiscalDeliveryCertainty,
  type FiscalDocumentRepository,
  type FiscalDocumentState,
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
import { mapDatabaseError, requireTransaction } from './unit-of-work.js';

const activeStates: FiscalDocumentState[] = ['PENDING', 'PRINTING', 'ERROR', 'RETRYING'];
const recoverableStates: FiscalDocumentState[] = ['PRINTING', 'ERROR', 'RETRYING'];

export class DrizzleFiscalDocumentRepository implements FiscalDocumentRepository {
  constructor(private readonly handle: DatabaseHandle) {}

  async save(document: FiscalDocument): Promise<void> {
    requireTransaction(this.handle.sqlite);
    try {
      const existing = this.handle.db.select().from(fiscalDocuments)
        .where(eq(fiscalDocuments.id, document.id)).get();
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
        this.handle.db.update(fiscalDocuments).set({
          status: document.status,
          version: document.version,
          attempts: document.attempts,
          fiscalNumber: document.fiscalNumber,
          lastErrorCode: document.lastErrorCode,
          lastCertainty: document.lastCertainty,
          lastFailureRetryable: document.lastFailureRetryable
        }).where(eq(fiscalDocuments.id, document.id)).run();
      }

      const persisted = new Set(this.handle.db.select({ eventId: fiscalDocumentTransitions.eventId })
        .from(fiscalDocumentTransitions)
        .where(eq(fiscalDocumentTransitions.documentId, document.id)).all()
        .map(({ eventId }) => eventId));
      const transitions = document.transitions.filter(({ eventId }) => !persisted.has(eventId));
      if (transitions.length > 0) {
        this.handle.db.insert(fiscalDocumentTransitions).values(transitions.map((transition) => ({
          eventId: transition.eventId,
          documentId: document.id,
          aggregateVersion: transition.version,
          fromStatus: transition.from,
          toStatus: transition.to,
          actorId: transition.actorId,
          occurredAt: transition.occurredAt,
          errorCode: transition.errorCode,
          certainty: transition.certainty
        }))).run();
      }
    } catch (error) {
      throw mapDatabaseError(error);
    }
  }

  findById(id: string): Promise<FiscalDocument | null> {
    return this.read(() => this.restore(this.handle.db.select().from(fiscalDocuments)
      .where(eq(fiscalDocuments.id, id)).get()));
  }

  findByIdempotencyKey(originNodeId: string, key: string): Promise<FiscalDocument | null> {
    return this.read(() => this.restore(this.handle.db.select().from(fiscalDocuments).where(and(
      eq(fiscalDocuments.originNodeId, originNodeId),
      eq(fiscalDocuments.idempotencyKey, key)
    )).get()));
  }

  findActive(): Promise<FiscalDocument | null> {
    return this.read(() => this.restore(this.handle.db.select().from(fiscalDocuments)
      .where(inArray(fiscalDocuments.status, activeStates)).get()));
  }

  findRecoverable(): Promise<FiscalDocument[]> {
    return this.read(() => this.handle.db.select().from(fiscalDocuments)
      .where(inArray(fiscalDocuments.status, recoverableStates)).all()
      .map((row) => this.restore(row) as FiscalDocument));
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
        totalMinorUnits: row.totalMinorUnits
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
      lastCertainty: row.lastCertainty as FiscalDeliveryCertainty | null,
      lastFailureRetryable: row.lastFailureRetryable,
      transitions: transitions.map((transition) => ({
        eventId: transition.eventId,
        version: transition.aggregateVersion,
        from: transition.fromStatus as FiscalDocumentState | null,
        to: transition.toStatus as FiscalDocumentState,
        actorId: transition.actorId,
        occurredAt: transition.occurredAt,
        errorCode: transition.errorCode,
        certainty: transition.certainty as FiscalDeliveryCertainty | null
      }))
    });
  }

  private documentValues(document: FiscalDocument): typeof fiscalDocuments.$inferInsert {
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
      lastCertainty: document.lastCertainty,
      lastFailureRetryable: document.lastFailureRetryable
    };
  }

  private assertPersistedIdentity(
    row: typeof fiscalDocuments.$inferSelect,
    document: FiscalDocument
  ): void {
    if (row.referenceId !== document.content.referenceId ||
      row.documentType !== document.content.type ||
      row.currencyCode !== document.content.currencyCode ||
      row.totalMinorUnits !== document.content.totalMinorUnits ||
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
