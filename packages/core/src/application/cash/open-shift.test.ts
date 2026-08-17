import { describe, expect, it } from 'vitest';
import { CashRegister, Shift } from '../../domain/cash/index.js';
import { PaymentMethod } from '../../domain/currency/index.js';
import type { ExecutionContext } from '../execution-context.js';
import type {
  CashRegisterRepository,
  PaymentMethodRepository,
  ShiftRepository
} from '../ports/index.js';
import { OpenShift } from './open-shift.js';

const context: ExecutionContext = {
  actorId: 'user-001',
  terminalId: 'terminal-001',
  originNodeId: 'node-001',
  correlationId: 'correlation-001'
};

const cashMethod = PaymentMethod.create({
  code: 'CASH_USD',
  name: 'Cash USD',
  kind: 'CASH',
  currencyCode: 'USD'
});

class FakeCashRegisterRepository implements CashRegisterRepository {
  constructor(readonly cashRegister: CashRegister | null) {}

  async findById(): Promise<CashRegister | null> {
    return this.cashRegister;
  }
}

class FakePaymentMethodRepository implements PaymentMethodRepository {
  async findByCode(code: string): Promise<PaymentMethod | null> {
    return code === cashMethod.code ? cashMethod : null;
  }
}

class FakeShiftRepository implements ShiftRepository {
  stored: Shift | null = null;
  openShift: Shift | null = null;
  saves = 0;

  async save(shift: Shift): Promise<void> {
    this.stored = shift;
    this.saves += 1;
  }

  async findById(): Promise<Shift | null> {
    return this.stored;
  }

  async findOpenByCashRegisterId(): Promise<Shift | null> {
    return this.openShift;
  }
}

function register(overrides: { terminalId?: string; isActive?: boolean } = {}): CashRegister {
  return CashRegister.create({
    id: 'register-001',
    name: 'Main register',
    terminalId: overrides.terminalId ?? 'terminal-001',
    originNodeId: 'node-001',
    ...(overrides.isActive === undefined ? {} : { isActive: overrides.isActive })
  });
}

function createUseCase(
  cashRegisterRepository: CashRegisterRepository,
  shiftRepository: ShiftRepository,
  authorized = true
): OpenShift {
  return new OpenShift(
    cashRegisterRepository,
    shiftRepository,
    new FakePaymentMethodRepository(),
    { authorize: async () => authorized },
    { generate: () => 'shift-001' },
    { generate: () => 'movement-001' },
    { generate: () => 'event-001' },
    { now: () => new Date('2026-08-16T08:00:00.000Z') }
  );
}

describe('OpenShift', () => {
  it('opens one shift for the execution terminal with its opening float', async () => {
    const repository = new FakeShiftRepository();
    const useCase = createUseCase(new FakeCashRegisterRepository(register()), repository);

    const result = await useCase.execute({
      cashRegisterId: 'register-001',
      openingFunds: [{
        paymentMethodCode: 'CASH_USD',
        currencyCode: 'USD',
        amountMinorUnits: 10_000
      }]
    }, context);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe('OPEN');
    expect(result.value.expectedBalances).toEqual([{
      paymentMethodCode: 'CASH_USD',
      currencyCode: 'USD',
      minorUnits: 10_000
    }]);
    expect(repository.stored?.movements[0]?.type).toBe('OPENING_FLOAT');
    expect(repository.stored?.domainEvents.map((event) => event.type)).toEqual(['ShiftOpened']);
    expect(repository.saves).toBe(1);
  });

  it('rejects a second open shift for the same cash register', async () => {
    const repository = new FakeShiftRepository();
    repository.openShift = Shift.open({
      id: 'shift-existing',
      cashRegister: register(),
      openingFunds: [],
      openedBy: 'user-001',
      openedAt: new Date('2026-08-16T07:00:00.000Z'),
      eventId: 'event-existing'
    });
    const useCase = createUseCase(new FakeCashRegisterRepository(register()), repository);

    const result = await useCase.execute({ cashRegisterId: 'register-001', openingFunds: [] }, context);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('SHIFT_ALREADY_OPEN');
    expect(repository.saves).toBe(0);
  });

  it('rejects an unauthorized or foreign cash register before saving', async () => {
    const unauthorizedRepository = new FakeShiftRepository();
    const unauthorized = createUseCase(
      new FakeCashRegisterRepository(register()),
      unauthorizedRepository,
      false
    );
    const forbidden = await unauthorized.execute({ cashRegisterId: 'register-001', openingFunds: [] }, context);

    expect(forbidden.ok).toBe(false);
    if (!forbidden.ok) expect(forbidden.error.code).toBe('FORBIDDEN');

    const foreignRepository = new FakeShiftRepository();
    const foreign = createUseCase(
      new FakeCashRegisterRepository(register({ terminalId: 'terminal-002' })),
      foreignRepository
    );
    const mismatch = await foreign.execute({ cashRegisterId: 'register-001', openingFunds: [] }, context);

    expect(mismatch.ok).toBe(false);
    if (!mismatch.ok) expect(mismatch.error.code).toBe('CASH_REGISTER_OWNERSHIP_MISMATCH');
    expect(foreignRepository.saves).toBe(0);
  });

  it('rejects a missing or inactive cash register', async () => {
    const missing = await createUseCase(
      new FakeCashRegisterRepository(null),
      new FakeShiftRepository()
    ).execute({ cashRegisterId: 'register-missing', openingFunds: [] }, context);
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.code).toBe('CASH_REGISTER_NOT_FOUND');

    const inactive = await createUseCase(
      new FakeCashRegisterRepository(register({ isActive: false })),
      new FakeShiftRepository()
    ).execute({ cashRegisterId: 'register-001', openingFunds: [] }, context);
    expect(inactive.ok).toBe(false);
    if (!inactive.ok) expect(inactive.error.code).toBe('CASH_REGISTER_INACTIVE');
  });
});
