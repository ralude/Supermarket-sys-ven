import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull()
});

export const unitsOfMeasure = sqliteTable('units_of_measure', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  quantityScale: integer('quantity_scale').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull()
});

export const paymentMethods = sqliteTable('payment_methods', {
  code: text('code').primaryKey(),
  name: text('name').notNull(),
  kind: text('kind').notNull(),
  currencyCode: text('currency_code').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull()
});

export const cashRegisters = sqliteTable('cash_registers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  terminalId: text('terminal_id').notNull(),
  originNodeId: text('origin_node_id').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull()
});

export const exchangeRates = sqliteTable('exchange_rates', {
  id: text('id').primaryKey(),
  baseCurrency: text('base_currency').notNull(),
  quoteCurrency: text('quote_currency').notNull(),
  rateValue: integer('rate_value').notNull(),
  rateScale: integer('rate_scale').notNull(),
  source: text('source').notNull(),
  validFrom: integer('valid_from').notNull(),
  validUntil: integer('valid_until'),
  registeredBy: text('registered_by').notNull()
});

export const products = sqliteTable('products', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  categoryId: text('category_id').notNull(),
  unitId: text('unit_id').notNull(),
  priceMinorUnits: integer('price_minor_units').notNull(),
  currencyCode: text('currency_code').notNull(),
  taxRateBasisPoints: integer('tax_rate_basis_points').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull(),
  version: integer('version').notNull()
});

export const productBarcodes = sqliteTable('product_barcodes', {
  id: text('id').primaryKey(),
  productId: text('product_id').notNull(),
  value: text('value').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull()
});

export const productPriceHistory = sqliteTable('product_price_history', {
  id: text('id').primaryKey(),
  productId: text('product_id').notNull(),
  priceMinorUnits: integer('price_minor_units').notNull(),
  currencyCode: text('currency_code').notNull(),
  recordedAt: integer('recorded_at').notNull(),
  recordedBy: text('recorded_by').notNull(),
  reason: text('reason').notNull()
});

export const sales = sqliteTable('sales', {
  id: text('id').primaryKey(),
  currencyCode: text('currency_code').notNull(),
  terminalId: text('terminal_id').notNull(),
  originNodeId: text('origin_node_id').notNull(),
  startedBy: text('started_by').notNull(),
  startedAt: integer('started_at').notNull(),
  status: text('status').notNull(),
  version: integer('version').notNull(),
  financialTransactionTaxMinorUnits: integer('financial_transaction_tax_minor_units').notNull(),
  completedAt: integer('completed_at'),
  voidedAt: integer('voided_at'),
  voidReason: text('void_reason'),
  voidedBy: text('voided_by')
});

export const saleItems = sqliteTable('sale_items', {
  id: text('id').primaryKey(),
  saleId: text('sale_id').notNull(),
  productId: text('product_id').notNull(),
  description: text('description').notNull(),
  priceMinorUnits: integer('price_minor_units').notNull(),
  currencyCode: text('currency_code').notNull(),
  taxRateBasisPoints: integer('tax_rate_basis_points').notNull(),
  unitCode: text('unit_code').notNull(),
  unitScale: integer('unit_scale').notNull(),
  quantityScaled: integer('quantity_scaled').notNull(),
  quantityScale: integer('quantity_scale').notNull()
});

export const saleDiscounts = sqliteTable('sale_discounts', {
  id: text('id').primaryKey(),
  saleId: text('sale_id').notNull(),
  itemId: text('item_id'),
  percentageBasisPoints: integer('percentage_basis_points').notNull(),
  amountMinorUnits: integer('amount_minor_units').notNull(),
  currencyCode: text('currency_code').notNull(),
  reason: text('reason').notNull(),
  appliedBy: text('applied_by').notNull(),
  appliedAt: integer('applied_at').notNull()
});

export const salePayments = sqliteTable('sale_payments', {
  id: text('id').primaryKey(),
  saleId: text('sale_id').notNull(),
  paymentMethodCode: text('payment_method_code').notNull(),
  paymentMethodName: text('payment_method_name').notNull(),
  paymentMethodKind: text('payment_method_kind').notNull(),
  amountMinorUnits: integer('amount_minor_units').notNull(),
  currencyCode: text('currency_code').notNull(),
  amountInSaleCurrencyMinorUnits: integer('amount_in_sale_currency_minor_units').notNull(),
  saleCurrencyCode: text('sale_currency_code').notNull(),
  exchangeRateId: text('exchange_rate_id'),
  exchangeRateBaseCurrency: text('exchange_rate_base_currency'),
  exchangeRateQuoteCurrency: text('exchange_rate_quote_currency'),
  exchangeRateValue: integer('exchange_rate_value'),
  exchangeRateScale: integer('exchange_rate_scale'),
  exchangeRateSource: text('exchange_rate_source'),
  exchangeRateValidFrom: integer('exchange_rate_valid_from'),
  exchangeRateValidUntil: integer('exchange_rate_valid_until'),
  exchangeRateRegisteredBy: text('exchange_rate_registered_by'),
  registeredBy: text('registered_by').notNull(),
  registeredAt: integer('registered_at').notNull()
});

export const shifts = sqliteTable('shifts', {
  id: text('id').primaryKey(),
  cashRegisterId: text('cash_register_id').notNull(),
  terminalId: text('terminal_id').notNull(),
  originNodeId: text('origin_node_id').notNull(),
  openedBy: text('opened_by').notNull(),
  openedAt: integer('opened_at').notNull(),
  status: text('status').notNull(),
  version: integer('version').notNull(),
  closedAt: integer('closed_at'),
  closedBy: text('closed_by')
});

export const cashMovements = sqliteTable('cash_movements', {
  id: text('id').primaryKey(),
  shiftId: text('shift_id').notNull(),
  type: text('type').notNull(),
  paymentMethodCode: text('payment_method_code').notNull(),
  paymentMethodName: text('payment_method_name').notNull(),
  paymentMethodKind: text('payment_method_kind').notNull(),
  amountMinorUnits: integer('amount_minor_units').notNull(),
  currencyCode: text('currency_code').notNull(),
  reason: text('reason').notNull(),
  registeredBy: text('registered_by').notNull(),
  registeredAt: integer('registered_at').notNull()
});

export const shiftClosingBalances = sqliteTable('shift_closing_balances', {
  shiftId: text('shift_id').notNull(),
  paymentMethodCode: text('payment_method_code').notNull(),
  currencyCode: text('currency_code').notNull(),
  expectedMinorUnits: integer('expected_minor_units').notNull(),
  declaredMinorUnits: integer('declared_minor_units').notNull(),
  differenceMinorUnits: integer('difference_minor_units').notNull()
}, (table) => [primaryKey({ columns: [table.shiftId, table.paymentMethodCode, table.currencyCode] })]);
