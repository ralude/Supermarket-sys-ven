import { DomainError, Money } from '@supermarket/shared';
import type { PaymentMethod } from '../currency/index.js';
import {
  CashMovement,
  type CashMovementReference,
  type CashMovementType
} from './cash-movement.js';
import type { CashRegister } from './cash-register.js';
import type { ShiftDomainEvent } from './shift-events.js';

export const SHIFT_STATUSES = ['OPEN', 'CLOSED'] as const;
export type ShiftStatus = (typeof SHIFT_STATUSES)[number];

export type OpeningFund = {
  id: string;
  method: PaymentMethod;
  amount: Money;
};

export type ShiftBalance = {
  paymentMethodCode: string;
  amount: Money;
};

export type ShiftClosingBalance = {
  paymentMethodCode: string;
  expected: Money;
  declared: Money;
  difference: Money;
};

export type OpenShiftProps = {
  id: string;
  cashRegister: CashRegister;
  openingFunds: OpeningFund[];
  openedBy: string;
  openedAt: Date;
  eventId: string;
};

export type RegisterMovementProps = {
  id: string;
  type: Exclude<CashMovementType, 'OPENING_FLOAT'>;
  method: PaymentMethod;
  amount: Money;
  reason: string;
  registeredBy: string;
  terminalId: string;
  originNodeId: string;
  occurredAt: Date;
  eventId: string;
  reference?: CashMovementReference;
};

export type CloseShiftProps = {
  declaredBalances: Array<{ method: PaymentMethod; amount: Money }>;
  closedBy: string;
  terminalId: string;
  originNodeId: string;
  closedAt: Date;
  eventId: string;
};

export type RestoredShiftProps = {
  id: string;
  cashRegisterId: string;
  terminalId: string;
  originNodeId: string;
  openedBy: string;
  openedAt: Date;
  movements: CashMovement[];
  status: ShiftStatus;
  version: number;
  closingBalances: ShiftClosingBalance[] | null;
  closedAt: Date | null;
  closedBy: string | null;
};

const balanceKey = (paymentMethodCode: string, currencyCode: string): string =>
  `${paymentMethodCode}:${currencyCode}`;

export class Shift {
  private readonly currentMovements: CashMovement[];
  private readonly events: ShiftDomainEvent[];
  private currentStatus: ShiftStatus = 'OPEN';
  private currentVersion = 1;
  private currentClosingBalances: ShiftClosingBalance[] | null = null;
  private currentClosedAt: Date | null = null;
  private currentClosedBy: string | null = null;
  private readonly openingTimestamp: Date;

  private constructor(
    readonly id: string,
    readonly cashRegisterId: string,
    readonly terminalId: string,
    readonly originNodeId: string,
    readonly openedBy: string,
    openedAt: Date,
    movements: CashMovement[],
    event: ShiftDomainEvent
  ) {
    this.openingTimestamp = new Date(openedAt);
    this.currentMovements = [...movements];
    this.events = [event];
  }

  static open(props: OpenShiftProps): Shift {
    props.cashRegister.assertOperationalFor(
      props.cashRegister.terminalId,
      props.cashRegister.originNodeId
    );
    Shift.assertText(props.id, 'SHIFT_ID_REQUIRED', 'Shift ID is required.');
    Shift.assertText(props.openedBy, 'SHIFT_ACTOR_REQUIRED', 'Shift actor is required.');
    Shift.assertTimestamp(props.openedAt, 'SHIFT_INVALID_TIMESTAMP', 'Shift timestamp is invalid.');
    Shift.assertUniqueFunds(props.openingFunds);

    const movements = props.openingFunds.map((fund) => CashMovement.create({
      id: fund.id,
      type: 'OPENING_FLOAT',
      method: fund.method,
      amount: fund.amount,
      reason: 'Opening float',
      registeredBy: props.openedBy,
      registeredAt: props.openedAt
    }));
    const event: ShiftDomainEvent = {
      type: 'ShiftOpened',
      eventId: props.eventId,
      aggregateId: props.id,
      aggregateType: 'Shift',
      aggregateVersion: 1,
      occurredAt: new Date(props.openedAt),
      payload: {
        cashRegisterId: props.cashRegister.id,
        terminalId: props.cashRegister.terminalId,
        originNodeId: props.cashRegister.originNodeId,
        openedBy: props.openedBy,
        openingBalances: movements.map((movement) => ({
          paymentMethodCode: movement.method.code,
          amount: movement.amount
        }))
      }
    };
    return new Shift(
      props.id.trim(),
      props.cashRegister.id,
      props.cashRegister.terminalId,
      props.cashRegister.originNodeId,
      props.openedBy.trim(),
      props.openedAt,
      movements,
      event
    );
  }

  /** Rehydrates persisted state without publishing historical domain events. */
  static restore(props: RestoredShiftProps): Shift {
    const shift = new Shift(
      props.id,
      props.cashRegisterId,
      props.terminalId,
      props.originNodeId,
      props.openedBy,
      props.openedAt,
      props.movements,
      {
        type: 'ShiftOpened',
        eventId: 'restored',
        aggregateId: props.id,
        aggregateType: 'Shift',
        aggregateVersion: props.version,
        occurredAt: props.openedAt,
        payload: {
          cashRegisterId: props.cashRegisterId,
          terminalId: props.terminalId,
          originNodeId: props.originNodeId,
          openedBy: props.openedBy,
          openingBalances: []
        }
      }
    );
    shift.currentStatus = props.status;
    shift.currentVersion = props.version;
    shift.currentClosingBalances = props.closingBalances;
    shift.currentClosedAt = props.closedAt === null ? null : new Date(props.closedAt);
    shift.currentClosedBy = props.closedBy;
    shift.events.splice(0);
    return shift;
  }

  get status(): ShiftStatus { return this.currentStatus; }
  get version(): number { return this.currentVersion; }
  get movements(): readonly CashMovement[] { return this.currentMovements; }
  get domainEvents(): readonly ShiftDomainEvent[] { return this.events; }
  get openedAt(): Date { return new Date(this.openingTimestamp); }
  get closedAt(): Date | null { return this.currentClosedAt === null ? null : new Date(this.currentClosedAt); }
  get closedBy(): string | null { return this.currentClosedBy; }
  get closingBalances(): readonly ShiftClosingBalance[] | null {
    return this.currentClosingBalances === null ? null : [...this.currentClosingBalances];
  }

  get expectedBalances(): readonly ShiftBalance[] {
    const balances = new Map<string, ShiftBalance>();
    for (const movement of this.currentMovements) {
      const key = balanceKey(movement.method.code, movement.amount.currency);
      const existing = balances.get(key)?.amount ?? Money.zero(movement.amount.currency);
      const amount = movement.type === 'WITHDRAWAL' || movement.type === 'SALE_REFUND'
        ? existing.subtract(movement.amount)
        : existing.add(movement.amount);
      balances.set(key, { paymentMethodCode: movement.method.code, amount });
    }
    return [...balances.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([, value]) => value);
  }

  registerMovement(props: RegisterMovementProps): CashMovement {
    this.assertOwnership(props.terminalId, props.originNodeId);
    const existing = this.currentMovements.find((movement) => movement.id === props.id);
    if (existing?.type === 'SALE_PAYMENT' && props.type === 'SALE_PAYMENT') {
      if (existing.matches({ ...props, registeredAt: props.occurredAt })) return existing;
      throw new DomainError(
        'CASH_SALE_PAYMENT_CONFLICT',
        'Sale payment identifier conflicts with another movement.'
      );
    }
    if (existing) {
      throw new DomainError('CASH_MOVEMENT_DUPLICATE', 'Cash movement already exists.');
    }
    this.assertOpen();
    this.assertOccurredDuringShift(props.occurredAt);
    const movement = CashMovement.create({
      id: props.id,
      type: props.type,
      method: props.method,
      amount: props.amount,
      reason: props.reason,
      registeredBy: props.registeredBy,
      registeredAt: props.occurredAt,
      ...(props.reference ? { reference: props.reference } : {})
    });
    if (movement.type === 'WITHDRAWAL') {
      const available = this.balanceFor(movement.method.code, movement.amount.currency);
      if (movement.amount.minorUnits > available.minorUnits) {
        throw new DomainError(
          'CASH_WITHDRAWAL_INSUFFICIENT_FUNDS',
          'Cash withdrawal exceeds the available balance.'
        );
      }
    }
    this.currentMovements.push(movement);
    this.recordEvent({
      type: 'CashMovementRegistered',
      eventId: props.eventId,
      occurredAt: props.occurredAt,
      payload: {
        movementId: movement.id,
        movementType: movement.type,
        paymentMethodCode: movement.method.code,
        amount: movement.amount,
        reason: movement.reason,
        registeredBy: movement.registeredBy,
        reference: movement.reference
      }
    });
    return movement;
  }

  close(props: CloseShiftProps): void {
    this.assertOpen();
    this.assertOwnership(props.terminalId, props.originNodeId);
    this.assertOccurredDuringShift(props.closedAt);
    Shift.assertText(props.closedBy, 'SHIFT_ACTOR_REQUIRED', 'Shift actor is required.');
    const declared = new Map<string, ShiftBalance>();
    for (const balance of props.declaredBalances) {
      if (balance.amount.minorUnits < 0) {
        throw new DomainError(
          'SHIFT_CLOSING_BALANCE_NEGATIVE',
          'Declared closing balance cannot be negative.'
        );
      }
      if (balance.method.currencyCode !== balance.amount.currency) {
        throw new DomainError(
          'PAYMENT_METHOD_CURRENCY_MISMATCH',
          'Payment method currency must match declared balance currency.'
        );
      }
      const key = balanceKey(balance.method.code, balance.amount.currency);
      if (declared.has(key)) {
        throw new DomainError(
          'SHIFT_CLOSING_BALANCE_DUPLICATE',
          'Declared closing balance must be unique by payment method and currency.'
        );
      }
      declared.set(key, { paymentMethodCode: balance.method.code, amount: balance.amount });
    }

    const expected = new Map(
      this.expectedBalances.map((balance) => [
        balanceKey(balance.paymentMethodCode, balance.amount.currency),
        balance
      ])
    );
    const keys = [...new Set([...expected.keys(), ...declared.keys()])].sort();
    const closingBalances = keys.map((key): ShiftClosingBalance => {
      const expectedBalance = expected.get(key);
      const declaredBalance = declared.get(key);
      const currency = expectedBalance?.amount.currency ?? declaredBalance?.amount.currency;
      if (currency === undefined) {
        throw new DomainError('SHIFT_CLOSING_BALANCE_INVALID', 'Closing balance is invalid.');
      }
      const expectedAmount = expectedBalance?.amount ?? Money.zero(currency);
      const declaredAmount = declaredBalance?.amount ?? Money.zero(currency);
      return {
        paymentMethodCode: expectedBalance?.paymentMethodCode ?? declaredBalance?.paymentMethodCode ?? '',
        expected: expectedAmount,
        declared: declaredAmount,
        difference: declaredAmount.subtract(expectedAmount)
      };
    });

    this.currentStatus = 'CLOSED';
    this.currentClosingBalances = closingBalances;
    this.currentClosedAt = new Date(props.closedAt);
    this.currentClosedBy = props.closedBy.trim();
    this.recordEvent({
      type: 'ShiftClosed',
      eventId: props.eventId,
      occurredAt: props.closedAt,
      payload: { closedBy: this.currentClosedBy, balances: closingBalances }
    });
  }

  balanceFor(paymentMethodCode: string, currencyCode: string): Money {
    return this.expectedBalances.find((balance) =>
      balance.paymentMethodCode === paymentMethodCode && balance.amount.currency === currencyCode
    )?.amount ?? Money.zero(currencyCode);
  }

  private assertOpen(): void {
    if (this.currentStatus !== 'OPEN') {
      throw new DomainError('SHIFT_INVALID_STATE', 'Only open shifts can be modified.');
    }
  }

  private assertOwnership(terminalId: string, originNodeId: string): void {
    if (this.terminalId !== terminalId || this.originNodeId !== originNodeId) {
      throw new DomainError(
        'SHIFT_OWNERSHIP_MISMATCH',
        'Shift belongs to another terminal or node.'
      );
    }
  }

  private assertOccurredDuringShift(timestamp: Date): void {
    Shift.assertTimestamp(timestamp, 'SHIFT_INVALID_TIMESTAMP', 'Shift timestamp is invalid.');
    if (timestamp.getTime() < this.openingTimestamp.getTime()) {
      throw new DomainError('SHIFT_TIMESTAMP_BEFORE_OPEN', 'Shift operation cannot occur before opening.');
    }
  }

  private recordEvent(
    event: Omit<ShiftDomainEvent, 'aggregateId' | 'aggregateType' | 'aggregateVersion'>
  ): void {
    this.currentVersion += 1;
    this.events.push({
      ...event,
      aggregateId: this.id,
      aggregateType: 'Shift',
      aggregateVersion: this.currentVersion,
      occurredAt: new Date(event.occurredAt)
    } as ShiftDomainEvent);
  }

  private static assertUniqueFunds(funds: readonly OpeningFund[]): void {
    const keys = new Set<string>();
    const ids = new Set<string>();
    for (const fund of funds) {
      const key = balanceKey(fund.method.code, fund.amount.currency);
      if (keys.has(key)) {
        throw new DomainError(
          'SHIFT_OPENING_BALANCE_DUPLICATE',
          'Opening balance must be unique by payment method and currency.'
        );
      }
      if (ids.has(fund.id)) {
        throw new DomainError('CASH_MOVEMENT_DUPLICATE', 'Cash movement already exists.');
      }
      keys.add(key);
      ids.add(fund.id);
    }
  }

  private static assertText(value: string, code: string, message: string): void {
    if (value.trim().length === 0) throw new DomainError(code, message);
  }

  private static assertTimestamp(value: Date, code: string, message: string): void {
    if (Number.isNaN(value.getTime())) throw new DomainError(code, message);
  }
}
