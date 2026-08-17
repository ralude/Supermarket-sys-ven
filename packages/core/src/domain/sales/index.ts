export { Discount, type DiscountProps } from './discount.js';
export { Payment, type PaymentProps } from './payment.js';
export {
  Sale,
  SALE_STATUSES,
  type AddItemProps,
  type ApplyDiscountProps,
  type RegisterPaymentsProps,
  type SaleStatus,
  type StartSaleProps
} from './sale.js';
export { SaleItem, type ApplyItemDiscountProps, type SaleItemProps } from './sale-item.js';
export type {
  DiscountAppliedEvent,
  PaymentRegisteredEvent,
  SaleCompletedEvent,
  SaleDomainEvent,
  SaleItemAddedEvent,
  SaleItemRemovedEvent,
  SaleStartedEvent,
  SaleVoidedEvent
} from './sale-events.js';
