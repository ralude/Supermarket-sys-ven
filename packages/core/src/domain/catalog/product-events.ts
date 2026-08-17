import type { Money, TaxRate } from '@supermarket/shared';

type ProductEventBase = {
  eventId: string;
  aggregateId: string;
  aggregateType: 'Product';
  aggregateVersion: number;
  occurredAt: Date;
};

export type ProductCreatedEvent = ProductEventBase & {
  type: 'ProductCreated';
  payload: {
    name: string;
    description: string;
    price: Money;
    taxRate: TaxRate;
  };
};

export type PriceChangedEvent = ProductEventBase & {
  type: 'PriceChanged';
  payload: {
    previousPrice: Money;
    price: Money;
    changedBy: string;
    reason: string | null;
  };
};

export type ProductDomainEvent = ProductCreatedEvent | PriceChangedEvent;
