export { Discount, type DiscountProps } from './discount.js';
export { Payment, type PaymentProps } from './payment.js';
export {
  Sale,
  SALE_STATUSES,
  type AddItemProps,
  type ApplyDiscountProps,
  type RegisterPaymentsProps,
  type SaleStatus,
  type SetRecipientProps,
  type StartSaleProps
} from './sale.js';
export {
  cloneSaleRecipientSnapshot,
  createSaleRecipientSnapshot,
  saleRecipientTypeFor,
  type SaleRecipientInput,
  type SaleRecipientSnapshot
} from './sale-recipient.js';
export {
  SaleReturn,
  type RegisterSaleReturnProps,
  type RestoreSaleReturnProps,
  type SaleReturnEvent,
  type SaleReturnLine
} from './sale-return.js';
export { SaleItem, type ApplyItemDiscountProps, type SaleItemProps } from './sale-item.js';
export type {
  DiscountAppliedEvent,
  PaymentRegisteredEvent,
  SaleCompletedEvent,
  SaleDomainEvent,
  SaleItemAddedEvent,
  SaleItemRemovedEvent,
  SaleRecipientChangedEvent,
  SaleStartedEvent,
  SaleVoidedEvent
} from './sale-events.js';
