import { describe, expect, it } from 'vitest';
import { Money } from '@supermarket/shared';
import { CashRegister, Shift } from '../../domain/cash/index.js';
import { PaymentMethod } from '../../domain/currency/index.js';
import type { ExecutionContext } from '../execution-context.js';
import type { PaymentMethodRepository, ShiftRepository } from '../ports/index.js';
import { RegisterCashMovement } from './register-cash-movement.js';

const context: ExecutionContext = {
  actorId: 'user-001',
  terminalId: 'terminal-001',
  originNodeId: 'node-001',
  correlationId: 'correlation-001'
};

const method = PaymentMethod.create({
  code: 'CASH_USD', name: 'Cash USD', kind: 'CASH', currencyCode: 'USD'
});

function openShift(): Shift {
  return Shift.open({
    id: 'shift-001',
    cashRegister: CashRegister.create({
      id: 'register-001', name: 'Main register', terminalId: 'terminal-001', originNodeId: 'node-001'
    }),
    openingFunds: [{ id: 'opening-001', method, amount: Money.fromMinorUnits(10_000, 'USD') }],
    openedBy: 'user-001',
    openedAt: new Date('2026-08-16T08:00:00.000Z'),
    eventId: 'event-001'
  });
}

class FakeShiftRepository implements ShiftRepository {
  saves = 0;
  constructor(public stored: Shift | null) {}
  async save(shift: Shift): Promise<void> { this.stored = shift; this.saves += 1; }
  async findById(): Promise<Shift | null> { return this.stored; }
  async findOpenByCashRegisterId(): Promise<Shift | null> { return this.stored; }
}

class FakePaymentMethodRepository implements PaymentMethodRepository {
  async findByCode(): Promise<PaymentMethod | null> { return method; }
}

function useCase(repository: ShiftRepository, authorized = true): RegisterCashMovement {
  let movementSequence = 1;
  let eventSequence = 1;
  return new RegisterCashMovement(
    repository,
    new FakePaymentMethodRepository(),
    { authorize: async () => authorized },
    { generate: () => `movement-${++movementSequence}` },
    { generate: () => `event-${++eventSequence}` },
    { now: () => new Date('2026-08-16T09:00:00.000Z') }
  );
}

describe('RegisterCashMovement', () => {
  it('registers an income and updates the matching balance', async () => {
    const repository = new FakeShiftRepository(openShift());
    const result = await useCase(repository).execute({
      shiftId: 'shift-001',
      type: 'INCOME',
      paymentMethodCode: 'CASH_USD',
      currencyCode: 'USD',
      amountMinorUnits: 2_500,
      reason: 'Additional change'
    }, context);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.expectedBalances[0]?.minorUnits).toBe(12_500);
    expect(repository.stored?.movements.at(-1)?.registeredBy).toBe('user-001');
    expect(repository.stored?.domainEvents.at(-1)?.type).toBe('CashMovementRegistered');
  });

  it('registers a withdrawal and rejects one above the available balance', async () => {
    const repository = new FakeShiftRepository(openShift());
    const service = useCase(repository);
    const withdrawn = await service.execute({
      shiftId: 'shift-001', type: 'WITHDRAWAL', paymentMethodCode: 'CASH_USD',
      currencyCode: 'USD', amountMinorUnits: 4_000, reason: 'Safe drop'
    }, context);

    expect(withdrawn.ok).toBe(true);
    if (!withdrawn.ok) return;
    expect(withdrawn.value.expectedBalances[0]?.minorUnits).toBe(6_000);

    const excessive = await service.execute({
      shiftId: 'shift-001', type: 'WITHDRAWAL', paymentMethodCode: 'CASH_USD',
      currencyCode: 'USD', amountMinorUnits: 6_001, reason: 'Safe drop'
    }, context);
    expect(excessive.ok).toBe(false);
    if (!excessive.ok) expect(excessive.error.code).toBe('CASH_WITHDRAWAL_INSUFFICIENT_FUNDS');
  });

  it('rejects a movement without permission or reason', async () => {
    const forbiddenRepository = new FakeShiftRepository(openShift());
    const forbidden = await useCase(forbiddenRepository, false).execute({
      shiftId: 'shift-001', type: 'WITHDRAWAL', paymentMethodCode: 'CASH_USD',
      currencyCode: 'USD', amountMinorUnits: 100, reason: 'Safe drop'
    }, context);
    expect(forbidden.ok).toBe(false);
    if (!forbidden.ok) expect(forbidden.error.code).toBe('FORBIDDEN');

    const repository = new FakeShiftRepository(openShift());
    const missingReason = await useCase(repository).execute({
      shiftId: 'shift-001', type: 'INCOME', paymentMethodCode: 'CASH_USD',
      currencyCode: 'USD', amountMinorUnits: 100, reason: '  '
    }, context);
    expect(missingReason.ok).toBe(false);
    if (!missingReason.ok) expect(missingReason.error.code).toBe('CASH_MOVEMENT_REASON_REQUIRED');
  });

  it('rejects a missing shift and a non-positive amount', async () => {
    const missing = await useCase(new FakeShiftRepository(null)).execute({
      shiftId: 'shift-missing', type: 'INCOME', paymentMethodCode: 'CASH_USD',
      currencyCode: 'USD', amountMinorUnits: 100, reason: 'Additional change'
    }, context);
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.code).toBe('SHIFT_NOT_FOUND');

    const repository = new FakeShiftRepository(openShift());
    const invalidAmount = await useCase(repository).execute({
      shiftId: 'shift-001', type: 'INCOME', paymentMethodCode: 'CASH_USD',
      currencyCode: 'USD', amountMinorUnits: 0, reason: 'Additional change'
    }, context);
    expect(invalidAmount.ok).toBe(false);
    if (!invalidAmount.ok) expect(invalidAmount.error.code).toBe('CASH_MOVEMENT_INVALID_AMOUNT');
    expect(repository.saves).toBe(0);
  });
});
