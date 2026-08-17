import type { Money } from '@supermarket/shared';
import type { CashMovementType } from './cash-movement.js';

export type ShiftEventBase = {
  eventId: string;
  aggregateId: string;
  aggregateType: 'Shift';
  aggregateVersion: number;
  occurredAt: Date;
};

export type ShiftOpenedEvent = ShiftEventBase & {
  type: 'ShiftOpened';
  payload: {
    cashRegisterId: string;
    terminalId: string;
    originNodeId: string;
    openedBy: string;
    openingBalances: ReadonlyArray<{ paymentMethodCode: string; amount: Money }>;
  };
};

export type CashMovementRegisteredEvent = ShiftEventBase & {
  type: 'CashMovementRegistered';
  payload: {
    movementId: string;
    movementType: CashMovementType;
    paymentMethodCode: string;
    amount: Money;
    reason: string;
    registeredBy: string;
  };
};

export type ShiftClosedEvent = ShiftEventBase & {
  type: 'ShiftClosed';
  payload: {
    closedBy: string;
    balances: ReadonlyArray<{
      paymentMethodCode: string;
      expected: Money;
      declared: Money;
      difference: Money;
    }>;
  };
};

export type ShiftDomainEvent = ShiftOpenedEvent | CashMovementRegisteredEvent | ShiftClosedEvent;
