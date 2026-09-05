import { afterEach, describe, expect, it } from 'vitest';
import { openDatabase, type DatabaseHandle } from './connection.js';
import { applyMigrations } from './migrations.js';
import {
  DrizzleAuditReportRepository,
  DrizzleCashClosureReportRepository,
  DrizzleFiscalOperationsReportRepository,
  DrizzleMarginReportRepository
} from './reporting-repositories.js';

const at = (iso: string): number => new Date(iso).getTime();

describe('reporting read repositories', () => {
  const handles: DatabaseHandle[] = [];
  afterEach(() => handles.splice(0).forEach((handle) => handle.close()));

  const setup = (): DatabaseHandle => {
    const handle = openDatabase(':memory:');
    handles.push(handle);
    applyMigrations(handle.sqlite);
    return handle;
  };

  it('projects closed shifts with their declared differences and movement count', async () => {
    const handle = setup();
    handle.sqlite.exec(`
      insert into cash_registers (id, name, terminal_id, origin_node_id, is_active)
      values ('register-1', 'Caja 1', 'terminal-001', 'node-001', 1),
             ('register-2', 'Caja 2', 'terminal-001', 'node-001', 1);
      insert into shifts (id, cash_register_id, terminal_id, origin_node_id, opened_by, opened_at, status, version, closed_at, closed_by)
      values
        ('shift-1', 'register-1', 'terminal-001', 'node-001', 'user-1', ${at('2026-09-01T08:00:00.000Z')}, 'CLOSED', 2, ${at('2026-09-01T16:00:00.000Z')}, 'user-2'),
        ('shift-2', 'register-2', 'terminal-001', 'node-001', 'user-1', ${at('2026-09-02T08:00:00.000Z')}, 'OPEN', 1, null, null);
      insert into cash_movements (id, shift_id, type, payment_method_code, payment_method_name, payment_method_kind, amount_minor_units, currency_code, reason, registered_by, registered_at)
      values ('movement-1', 'shift-1', 'INCOME', 'CASH', 'Efectivo', 'CASH', 5000, 'USD', 'Fondo', 'user-1', ${at('2026-09-01T09:00:00.000Z')});
      insert into shift_closing_balances (shift_id, payment_method_code, currency_code, expected_minor_units, declared_minor_units, difference_minor_units)
      values ('shift-1', 'CASH', 'USD', 5000, 4900, -100);
    `);

    const entries = await new DrizzleCashClosureReportRepository(handle)
      .findCashClosures({ limit: 100 });

    expect(entries.map((entry) => entry.shiftId)).toEqual(['shift-2', 'shift-1']);
    expect(entries[1]).toMatchObject({
      cashRegisterId: 'register-1', closedBy: 'user-2', movementCount: 1,
      balances: [{
        paymentMethodCode: 'CASH', currencyCode: 'USD',
        expectedMinorUnits: 5000, declaredMinorUnits: 4900, differenceMinorUnits: -100
      }]
    });
    expect(entries[0]).toMatchObject({ closedAt: null, movementCount: 0, balances: [] });

    const filtered = await new DrizzleCashClosureReportRepository(handle).findCashClosures({
      limit: 100, cashRegisterId: 'register-1', from: new Date('2026-09-01T00:00:00.000Z'),
      to: new Date('2026-09-01T23:59:59.999Z')
    });
    expect(filtered.map((entry) => entry.shiftId)).toEqual(['shift-1']);
  });

  it('redacts audit state summaries and honours the row limit', async () => {
    const handle = setup();
    const values = Array.from({ length: 5 }, (_, index) => `(
      'audit-${index}', 'user-1', '["supervisor"]', 'sale.void', 'Sale', 'sale-${index}',
      '{"pin":"[REDACTED]"}', '{"status":"VOIDED"}', 'Error de cobro', 'terminal-001',
      'node-001', ${at('2026-09-01T10:00:00.000Z') + index}, 'correlation-${index}'
    )`).join(',');
    handle.sqlite.exec(`
      insert into audit_log (audit_id, actor_id, actor_role_codes, action, entity_type, entity_id,
        before_state, after_state, reason, terminal_id, origin_node_id, occurred_at, correlation_id)
      values ${values};
    `);
    const repository = new DrizzleAuditReportRepository(handle);

    const entries = await repository.findAuditEntries({ limit: 2 });

    expect(entries.map((entry) => entry.auditId)).toEqual(['audit-4', 'audit-3']);
    expect(entries[0]).toMatchObject({
      actorRoleCodes: ['supervisor'], action: 'sale.void', entityType: 'Sale',
      reason: 'Error de cobro', terminalId: 'terminal-001', correlationId: 'correlation-4'
    });
    expect(JSON.stringify(entries)).not.toContain('beforeState');
    expect(JSON.stringify(entries)).not.toContain('afterState');
    expect(JSON.stringify(entries)).not.toContain('REDACTED');

    const filtered = await repository.findAuditEntries({ limit: 100, action: 'sale.complete' });
    expect(filtered).toEqual([]);
  });

  it('merges fiscal documents and reports with neutral evidence', async () => {
    const handle = setup();
    handle.sqlite.exec(`
      insert into fiscal_documents (id, reference_id, document_type, currency_code, total_minor_units,
        idempotency_key, request_fingerprint, terminal_id, origin_node_id, created_by, created_at,
        status, version, attempts, fiscal_number, last_error_code, last_dispatch_state,
        last_command_effect, last_fiscal_commit, last_print_delivery, last_failure_retryable)
      values ('document-1', 'sale-1', 'INVOICE', 'USD', 12500, 'key-1', 'fingerprint-1',
        'terminal-001', 'node-001', 'user-1', ${at('2026-09-01T12:00:00.000Z')}, 'ISSUED', 3, 1,
        'A-00000001', null, 'RESULT_RECEIVED', 'APPLIED', 'COMMITTED', 'COMPLETE', 0);
      insert into fiscal_days (id, business_date, terminal_id, origin_node_id, opened_by, opened_at, state, version)
      values ('day-1', '2026-09-01', 'terminal-001', 'node-001', 'user-1', ${at('2026-09-01T06:00:00.000Z')}, 'DAY_OPEN', 1);
      insert into fiscal_reports (id, day_id, origin_node_id, report_type, idempotency_key,
        request_fingerprint, status, attempts, report_number, last_error_code, last_dispatch_state,
        last_command_effect, last_fiscal_commit, last_print_delivery, retryable, requested_by, requested_at)
      values ('report-1', 'day-1', 'node-001', 'X', 'key-2', 'fingerprint-2', 'FAILED', 2, null,
        'FISCAL_PRINTER_TIMEOUT', 'STARTED', 'NOT_APPLIED', 'NOT_COMMITTED', 'INCOMPLETE', 1, 'user-1',
        ${at('2026-09-01T18:00:00.000Z')});
    `);

    const entries = await new DrizzleFiscalOperationsReportRepository(handle)
      .findFiscalOperations({ limit: 100 });

    expect(entries.map((entry) => [entry.kind, entry.id])).toEqual([
      ['REPORT', 'report-1'], ['DOCUMENT', 'document-1']
    ]);
    expect(entries[0]).toMatchObject({
      dayId: 'day-1', operationType: 'X', status: 'FAILED', attempts: 2,
      fiscalNumber: null, lastErrorCode: 'FISCAL_PRINTER_TIMEOUT',
      evidence: { lastDispatchState: 'STARTED', lastCommandEffect: 'NOT_APPLIED' }
    });
    expect(entries[1]).toMatchObject({
      referenceId: 'sale-1', operationType: 'INVOICE', fiscalNumber: 'A-00000001',
      evidence: { lastPrintDelivery: 'COMPLETE' }
    });
  });

  it('aggregates margin by product and currency from frozen sale-issue cost and completed sale revenue', async () => {
    const handle = setup();
    handle.sqlite.exec(`
      insert into stock_items (id, product_id, unit_code, quantity_scale, tracks_batches)
      values ('stock-1', 'product-1', 'UND', 0, 0);
      insert into stock_movements (id, stock_item_id, event_id, aggregate_version, type, direction,
        quantity_scaled, quantity_scale, actor_id, reason, reference_id, occurred_at,
        unit_cost_minor_units, cost_currency_code)
      values
        ('movement-1', 'stock-1', 'event-1', 1, 'PURCHASE_RECEIPT', 'IN', 10, 0, 'user-1', 'Compra', 'ref-1', ${at('2026-09-01T09:00:00.000Z')}, 100, 'USD'),
        ('movement-2', 'stock-1', 'event-2', 2, 'SALE_ISSUE', 'OUT', 4, 0, 'user-1', 'Venta', 'ref-2', ${at('2026-09-02T10:00:00.000Z')}, 100, 'USD');
      insert into sales (id, shift_id, currency_code, terminal_id, origin_node_id, started_by, started_at,
        status, version, financial_transaction_tax_minor_units, completed_at)
      values ('sale-1', 'shift-1', 'USD', 'terminal-001', 'node-001', 'user-1', ${at('2026-09-02T09:55:00.000Z')},
        'COMPLETED', 3, 0, ${at('2026-09-02T10:00:00.000Z')});
      insert into sale_items (id, sale_id, product_id, description, price_minor_units, currency_code,
        tax_rate_basis_points, unit_code, unit_scale, quantity_scaled, quantity_scale)
      values ('sale-item-1', 'sale-1', 'product-1', 'Producto uno', 150, 'USD', 1600, 'UND', 0, 4, 0);
    `);

    const repository = new DrizzleMarginReportRepository(handle);
    const entries = await repository.findMargins({ limit: 100 });

    expect(entries).toEqual([{
      productId: 'product-1', currencyCode: 'USD',
      quantitySoldScaled: 4, quantityScale: 0,
      revenueMinorUnits: 600, costMinorUnits: 400, marginMinorUnits: 200
    }]);

    expect(await repository.findMargins({
      limit: 100, from: new Date('2026-09-03T00:00:00.000Z')
    })).toEqual([]);
    expect(await repository.findMargins({ limit: 100, currencyCode: 'EUR' })).toEqual([]);
  });
});
