import type { Money, Quantity } from '@supermarket/shared';
import type { Payment } from './payment.js';

type SaleEventBase = {
  eventId: string;
  aggregateId: string;
  aggregateType: 'Sale';
  aggregateVersion: number;
  occurredAt: Date;
};

export type SaleStartedEvent = SaleEventBase & {
  type: 'SaleStarted';
  payload: { shiftId: string; currencyCode: string; terminalId: string; originNodeId: string };
};

export type SaleItemAddedEvent = SaleEventBase & {
  type: 'SaleItemAdded';
  payload: { itemId: string; productId: string; quantity: Quantity };
};

export type SaleItemRemovedEvent = SaleEventBase & {
  type: 'SaleItemRemoved';
  payload: { itemId: string };
};

export type DiscountAppliedEvent = SaleEventBase & {
  type: 'DiscountApplied';
  payload: { discountId: string; itemId: string; amount: Money; basisPoints: number };
};

export type PaymentRegisteredEvent = SaleEventBase & {
  type: 'PaymentRegistered';
  payload: { paymentId: string; amountInSaleCurrency: Money; methodCode: string };
};

export type SaleCompletedEvent = SaleEventBase & {
  type: 'SaleCompleted';
  payload: {
    shiftId: string;
    terminalId: string;
    total: Money;
    paidTotal: Money;
    payments: Array<{
      paymentId: string;
      methodCode: string;
      currencyCode: string;
      amountMinorUnits: number;
    }>;
    items: Array<{
      itemId: string;
      productId: string;
      quantityScaled: number;
      quantityScale: number;
    }>;
  };
};

export type SaleVoidedEvent = SaleEventBase & {
  type: 'SaleVoided';
  payload: { reason: string; voidedBy: string };
};

export type SaleDomainEvent =
  | SaleStartedEvent
  | SaleItemAddedEvent
  | SaleItemRemovedEvent
  | DiscountAppliedEvent
  | PaymentRegisteredEvent
  | SaleCompletedEvent
  | SaleVoidedEvent;

export type SalePaymentEventSource = Payment;
