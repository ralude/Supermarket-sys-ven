import { describe, expect, it } from 'vitest';
import { Money } from '@supermarket/shared';
import { CashRegister, Shift } from '../../domain/cash/index.js';
import { PaymentMethod } from '../../domain/currency/index.js';
import type { ExecutionContext } from '../execution-context.js';
import type { AuthorizationService, PaymentMethodRepository, ShiftRepository } from '../ports/index.js';
import { CloseShift } from './close-shift.js';

const context: ExecutionContext = {
  actorId: 'user-001', terminalId: 'terminal-001', originNodeId: 'node-001',
  correlationId: 'correlation-001'
};

const usdCash = PaymentMethod.create({
  code: 'CASH_USD', name: 'Cash USD', kind: 'CASH', currencyCode: 'USD'
});

function shift(): Shift {
  return Shift.open({
    id: 'shift-001',
    cashRegister: CashRegister.create({
      id: 'register-001', name: 'Main register', terminalId: 'terminal-001', originNodeId: 'node-001'
    }),
    openingFunds: [{ id: 'opening-001', method: usdCash, amount: Money.fromMinorUnits(10_000, 'USD') }],
    openedBy: 'user-001', openedAt: new Date('2026-08-16T08:00:00.000Z'), eventId: 'event-001'
  });
}

class FakeShiftRepository implements ShiftRepository {
  saves = 0;
  constructor(public stored: Shift | null) {}
  async save(value: Shift): Promise<void> { this.stored = value; this.saves += 1; }
  async findById(): Promise<Shift | null> { return this.stored; }
  async findOpenByCashRegisterId(): Promise<Shift | null> { return this.stored; }
}

class FakePaymentMethodRepository implements PaymentMethodRepository {
  async findByCode(code: string): Promise<PaymentMethod | null> {
    return code === usdCash.code ? usdCash : null;
  }
}

function useCase(
  repository: ShiftRepository,
  authorization: AuthorizationService = { authorize: async () => true }
): CloseShift {
  return new CloseShift(
    repository,
    new FakePaymentMethodRepository(),
    authorization,
    { generate: () => 'event-close' },
    { now: () => new Date('2026-08-16T18:00:00.000Z') }
  );
}

describe('CloseShift', () => {
  it('closes with expected, declared and difference snapshots', async () => {
    const repository = new FakeShiftRepository(shift());
    const authorizationCalls: Parameters<AuthorizationService['authorize']>[] = [];
    const result = await useCase(repository, {
      authorize: async (...args) => {
        authorizationCalls.push(args);
        return true;
      }
    }).execute({
      shiftId: 'shift-001',
      declaredBalances: [{
        paymentMethodCode: 'CASH_USD', currencyCode: 'USD', amountMinorUnits: 9_900
      }]
    }, context);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe('CLOSED');
    expect(result.value.closingBalances).toEqual([{
      paymentMethodCode: 'CASH_USD', currencyCode: 'USD',
      expectedMinorUnits: 10_000, declaredMinorUnits: 9_900, differenceMinorUnits: -100
    }]);
    expect(repository.stored?.domainEvents.at(-1)?.type).toBe('ShiftClosed');
    expect(authorizationCalls).toEqual([[context, 'cash.shift.close']]);
  });

  it('rejects duplicate declared balance keys without saving', async () => {
    const repository = new FakeShiftRepository(shift());
    const result = await useCase(repository).execute({
      shiftId: 'shift-001',
      declaredBalances: [
        { paymentMethodCode: 'CASH_USD', currencyCode: 'USD', amountMinorUnits: 10_000 },
        { paymentMethodCode: 'CASH_USD', currencyCode: 'USD', amountMinorUnits: 10_000 }
      ]
    }, context);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('SHIFT_CLOSING_BALANCE_DUPLICATE');
    expect(repository.saves).toBe(0);
  });

  it('rejects a second close and movements after closing', async () => {
    const repository = new FakeShiftRepository(shift());
    const service = useCase(repository);
    const first = await service.execute({ shiftId: 'shift-001', declaredBalances: [] }, context);
    expect(first.ok).toBe(true);

    const second = await service.execute({ shiftId: 'shift-001', declaredBalances: [] }, context);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error.code).toBe('SHIFT_INVALID_STATE');

    expect(() => repository.stored?.registerMovement({
      id: 'movement-late', type: 'INCOME', method: usdCash,
      amount: Money.fromMinorUnits(100, 'USD'), reason: 'Late movement',
      registeredBy: 'user-001', terminalId: 'terminal-001', originNodeId: 'node-001',
      occurredAt: new Date('2026-08-16T18:01:00.000Z'), eventId: 'event-late'
    })).toThrowError('Only open shifts can be modified.');
  });

  it('treats an omitted expected balance as a zero declaration', async () => {
    const repository = new FakeShiftRepository(shift());
    const result = await useCase(repository).execute({
      shiftId: 'shift-001', declaredBalances: []
    }, context);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.closingBalances).toEqual([{
      paymentMethodCode: 'CASH_USD', currencyCode: 'USD',
      expectedMinorUnits: 10_000, declaredMinorUnits: 0, differenceMinorUnits: -10_000
    }]);
  });

  it('rejects an unauthorized close or one requested by another owner', async () => {
    const forbiddenRepository = new FakeShiftRepository(shift());
    const forbidden = await useCase(forbiddenRepository, { authorize: async () => false }).execute({
      shiftId: 'shift-001', declaredBalances: []
    }, context);
    expect(forbidden.ok).toBe(false);
    if (!forbidden.ok) expect(forbidden.error.code).toBe('FORBIDDEN');

    const foreignRepository = new FakeShiftRepository(shift());
    const foreign = await useCase(foreignRepository).execute(
      { shiftId: 'shift-001', declaredBalances: [] },
      { ...context, terminalId: 'terminal-002' }
    );
    expect(foreign.ok).toBe(false);
    if (!foreign.ok) expect(foreign.error.code).toBe('SHIFT_OWNERSHIP_MISMATCH');
    expect(foreignRepository.saves).toBe(0);
  });
});
