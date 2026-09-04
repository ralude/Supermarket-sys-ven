import { afterEach, describe, expect, it } from 'vitest';
import { CashRegister, PaymentMethod } from '@supermarket/core';
import {
  DrizzleCashRegisterRepository,
  DrizzlePaymentMethodRepository,
  SqliteUnitOfWork
} from '@supermarket/driver-db';
import { buildApp } from '../app.ts';
import { ADMIN_PERMISSIONS, createSecurityRuntime, type SecurityRuntime } from '../runtime.ts';

describe('cash HTTP contracts', () => {
  const runtimes: SecurityRuntime[] = [];
  const apps: ReturnType<typeof buildApp>[] = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
    for (const runtime of runtimes.splice(0)) if (runtime.handle.sqlite.open) runtime.handle.close();
  });

  const setup = async () => {
    const runtime = createSecurityRuntime(':memory:', {
      terminalId: 'terminal-001', originNodeId: 'node-001'
    });
    runtimes.push(runtime);
    const provisioned = await runtime.provisionInitialAdmin.execute({
      operatorCode: 'OP001', displayName: 'Operador', pin: '123456',
      permissions: ADMIN_PERMISSIONS
    });
    expect(provisioned.ok).toBe(true);
    await new SqliteUnitOfWork(runtime.handle.sqlite).execute(async () => {
      await new DrizzleCashRegisterRepository(runtime.handle).save(CashRegister.create({
        id: 'register-001', name: 'Caja 1',
        terminalId: 'terminal-001', originNodeId: 'node-001'
      }));
      await new DrizzlePaymentMethodRepository(runtime.handle).save(PaymentMethod.create({
        code: 'CASH_USD', name: 'Efectivo USD', kind: 'CASH', currencyCode: 'USD'
      }));
    });
    const app = buildApp(runtime.dependencies);
    apps.push(app);
    const login = await app.inject({
      method: 'POST', url: '/api/v1/auth/session',
      payload: { operatorCode: 'OP001', pin: '123456' }
    });
    return { app, runtime, cookie: String(login.headers['set-cookie']).split(';')[0]! };
  };

  it('opens, recovers, moves and closes a shift through SQLite', async () => {
    const { app, runtime, cookie } = await setup();
    const opened = await app.inject({
      method: 'POST', url: '/api/v1/cash/shifts',
      headers: { cookie, 'idempotency-key': 'shift-open-001' },
      payload: {
        cashRegisterId: 'register-001',
        openingFunds: [{
          paymentMethodCode: 'CASH_USD', currencyCode: 'USD', amountMinorUnits: 1000
        }]
      }
    });
    expect(opened.statusCode).toBe(201);
    const shiftId = opened.json<{ id: string }>().id;
    const openedReplay = await app.inject({
      method: 'POST', url: '/api/v1/cash/shifts',
      headers: { cookie, 'idempotency-key': 'shift-open-001' },
      payload: {
        cashRegisterId: 'register-001',
        openingFunds: [{
          paymentMethodCode: 'CASH_USD', currencyCode: 'USD', amountMinorUnits: 1000
        }]
      }
    });
    expect(openedReplay.statusCode).toBe(201);
    expect(openedReplay.json()).toEqual(opened.json());

    const current = await app.inject({
      method: 'GET', url: '/api/v1/cash-registers/register-001/open-shift',
      headers: { cookie }
    });
    expect(current.statusCode).toBe(200);
    expect(current.json()).toMatchObject({ id: shiftId, status: 'OPEN' });

    const movement = async (
      key: string, type: 'INCOME' | 'WITHDRAWAL', amountMinorUnits: number
    ) => app.inject({
      method: 'POST', url: `/api/v1/cash/shifts/${shiftId}/movements`,
      headers: { cookie, 'idempotency-key': key },
      payload: {
        type, paymentMethodCode: 'CASH_USD', currencyCode: 'USD', amountMinorUnits,
        reason: type === 'INCOME' ? 'Fondo adicional' : 'Retiro de seguridad'
      }
    });
    expect((await movement('cash-income-001', 'INCOME', 500)).statusCode).toBe(200);
    expect((await movement('cash-income-001', 'INCOME', 500)).statusCode).toBe(200);
    const withdrawal = await movement('cash-withdrawal-001', 'WITHDRAWAL', 200);
    expect(withdrawal.statusCode).toBe(200);
    expect(withdrawal.json()).toMatchObject({
      expectedBalances: [{ paymentMethodCode: 'CASH_USD', minorUnits: 1300 }]
    });

    const closed = await app.inject({
      method: 'POST', url: `/api/v1/cash/shifts/${shiftId}/close`,
      headers: { cookie, 'idempotency-key': 'shift-close-001' },
      payload: {
        declaredBalances: [{
          paymentMethodCode: 'CASH_USD', currencyCode: 'USD', amountMinorUnits: 1300
        }]
      }
    });
    expect(closed.statusCode).toBe(200);
    expect(closed.json()).toMatchObject({
      status: 'CLOSED',
      closingBalances: [{ expectedMinorUnits: 1300, declaredMinorUnits: 1300 }]
    });
    const closedReplay = await app.inject({
      method: 'POST', url: `/api/v1/cash/shifts/${shiftId}/close`,
      headers: { cookie, 'idempotency-key': 'shift-close-001' },
      payload: {
        declaredBalances: [{
          paymentMethodCode: 'CASH_USD', currencyCode: 'USD', amountMinorUnits: 1300
        }]
      }
    });
    expect(closedReplay.statusCode).toBe(200);
    expect(closedReplay.json()).toEqual(closed.json());
    expect(runtime.handle.sqlite.prepare('select action from audit_log order by occurred_at')
      .pluck().all()).toEqual([
      'SHIFT_OPENED', 'CASH_INCOME_REGISTERED', 'CASH_WITHDRAWAL_REGISTERED', 'SHIFT_CLOSED'
    ]);
  });
});
