import { describe, expect, it } from 'vitest';
import { FiscalDocument } from './fiscal-document.js';
import type { FiscalDocumentContent } from './fiscal-types.js';

const content: FiscalDocumentContent = {
  referenceId: 'sale-001',
  type: 'INVOICE',
  currencyCode: 'USD',
  lines: [{
    id: 'line-001', description: 'Coffee', quantityScaled: 2, quantityScale: 0,
    unitPriceMinorUnits: 500, taxRateBasisPoints: 1600, totalMinorUnits: 1_160
  }],
  payments: [{ methodCode: 'CASH_USD', amountMinorUnits: 1_160 }],
  totalMinorUnits: 1_160
};

const at = (hour: number): Date => new Date(`2026-08-30T${String(hour).padStart(2, '0')}:00:00.000Z`);

const pending = (): FiscalDocument => FiscalDocument.create({
  id: 'fiscal-001', content, idempotencyKey: 'request-001',
  requestFingerprint: 'fingerprint-001', terminalId: 'terminal-001',
  originNodeId: 'node-001', createdBy: 'user-001', createdAt: at(10),
  eventId: 'event-001'
});

describe('FiscalDocument', () => {
  it('moves through printing and issued while preserving immutable content', () => {
    const document = pending();
    document.startPrinting({ actorId: 'user-001', occurredAt: at(11), eventId: 'event-002' });
    document.markIssued({
      fiscalNumber: 'INV-000001', actorId: 'user-001',
      occurredAt: at(12), eventId: 'event-003'
    });

    expect(document).toMatchObject({ status: 'ISSUED', fiscalNumber: 'INV-000001', attempts: 1 });
    expect(document.transitions.map(({ to }) => to)).toEqual(['PENDING', 'PRINTING', 'ISSUED']);
    expect(document.domainEvents.map(({ type }) => type)).toEqual([
      'FiscalDocumentPending', 'FiscalDocumentPrintingStarted', 'FiscalDocumentIssued'
    ]);
    expect(() => document.startPrinting({
      actorId: 'user-001', occurredAt: at(13), eventId: 'event-004'
    })).toThrowError('Issued fiscal documents are immutable.');
  });

  it('requires reconciliation before retrying an uncertain print', () => {
    const document = pending();
    document.startPrinting({ actorId: 'user-001', occurredAt: at(11), eventId: 'event-002' });
    document.recordError({
      code: 'FISCAL_PRINTER_TIMEOUT', certainty: 'UNKNOWN', retryable: true,
      actorId: 'user-001', occurredAt: at(12), eventId: 'event-003'
    });

    expect(() => document.beginRetry({
      confirmedNotIssued: false, actorId: 'user-001', occurredAt: at(13), eventId: 'event-004'
    })).toThrowError('Fiscal document cannot retry without confirmed device state.');
    document.markIssued({
      fiscalNumber: 'INV-000001', actorId: 'user-001',
      occurredAt: at(13), eventId: 'event-004'
    });
    expect(document.status).toBe('ISSUED');
  });

  it('allows a confirmed safe retry and a final failure', () => {
    const document = pending();
    document.startPrinting({ actorId: 'user-001', occurredAt: at(11), eventId: 'event-002' });
    document.recordError({
      code: 'FISCAL_PRINTER_PAPER_END', certainty: 'NOT_SENT', retryable: true,
      actorId: 'user-001', occurredAt: at(12), eventId: 'event-003'
    });
    document.beginRetry({
      confirmedNotIssued: true, actorId: 'user-001', occurredAt: at(13), eventId: 'event-004'
    });
    document.startPrinting({ actorId: 'user-001', occurredAt: at(14), eventId: 'event-005' });
    document.recordError({
      code: 'FISCAL_PRINTER_MEMORY_FULL', certainty: 'REJECTED', retryable: false,
      actorId: 'user-001', occurredAt: at(15), eventId: 'event-006'
    });
    document.markFailed({ actorId: 'user-001', occurredAt: at(16), eventId: 'event-007' });

    expect(document.status).toBe('FAILED');
    expect(document.attempts).toBe(2);
  });

  it('validates fiscal totals and scaled quantities', () => {
    expect(() => FiscalDocument.create({
      id: 'fiscal-001', content: { ...content, totalMinorUnits: 1_159 },
      idempotencyKey: 'request-001', requestFingerprint: 'fingerprint-001',
      terminalId: 'terminal-001', originNodeId: 'node-001', createdBy: 'user-001',
      createdAt: at(10), eventId: 'event-001'
    })).toThrowError('Fiscal document totals are inconsistent.');
  });
});
