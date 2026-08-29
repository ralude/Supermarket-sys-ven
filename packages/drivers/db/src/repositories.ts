import {
  Barcode,
  CashMovement,
  CashRegister,
  Category,
  Discount,
  ExchangeRate,
  Payment,
  PaymentMethod,
  PriceHistory,
  Product,
  ProductSnapshot,
  Sale,
  SaleItem,
  Shift,
  UnitOfMeasure,
  type CashRegisterRepository,
  type CategoryRepository,
  type ExchangeRateRepository,
  type PaymentMethodKind,
  type PaymentMethodRepository,
  type ProductRepository,
  type SaleRepository,
  type ShiftRepository,
  type UnitOfMeasureRepository
} from '@supermarket/core';
import { InfrastructureError, Money, Percentage, Quantity, TaxRate } from '@supermarket/shared';
import { and, desc, eq, gt, isNull, lte, or } from 'drizzle-orm';
import type { DatabaseHandle } from './connection.js';
import {
  cashMovements,
  cashRegisters,
  categories,
  exchangeRates,
  paymentMethods,
  productBarcodes,
  productPriceHistory,
  products,
  saleDiscounts,
  saleItems,
  salePayments,
  sales,
  shiftClosingBalances,
  shifts,
  unitsOfMeasure
} from './schema.js';
import { mapDatabaseError, requireTransaction } from './unit-of-work.js';

const read = async <T>(operation: () => T): Promise<T> => {
  try {
    return operation();
  } catch (error) {
    throw mapDatabaseError(error);
  }
};

export class DrizzleCategoryRepository implements CategoryRepository {
  constructor(private readonly handle: DatabaseHandle) {}

  async save(category: Category): Promise<void> {
    requireTransaction(this.handle.sqlite);
    this.handle.db.insert(categories).values(category).onConflictDoUpdate({
      target: categories.id,
      set: { name: category.name, isActive: category.isActive }
    }).run();
  }

  findById(id: string): Promise<Category | null> {
    return read(() => {
      const row = this.handle.db.select().from(categories).where(eq(categories.id, id)).get();
      return row ? Category.create(row) : null;
    });
  }
}

export class DrizzleUnitOfMeasureRepository implements UnitOfMeasureRepository {
  constructor(private readonly handle: DatabaseHandle) {}

  async save(unit: UnitOfMeasure): Promise<void> {
    requireTransaction(this.handle.sqlite);
    this.handle.db.insert(unitsOfMeasure).values(unit).onConflictDoUpdate({
      target: unitsOfMeasure.id,
      set: {
        code: unit.code,
        name: unit.name,
        quantityScale: unit.quantityScale,
        isActive: unit.isActive
      }
    }).run();
  }

  findByCode(code: string): Promise<UnitOfMeasure | null> {
    return read(() => {
      const row = this.handle.db.select().from(unitsOfMeasure)
        .where(eq(unitsOfMeasure.code, code)).get();
      return row ? UnitOfMeasure.create(row) : null;
    });
  }
}

export class DrizzlePaymentMethodRepository implements PaymentMethodRepository {
  constructor(private readonly handle: DatabaseHandle) {}

  async save(method: PaymentMethod): Promise<void> {
    requireTransaction(this.handle.sqlite);
    this.handle.db.insert(paymentMethods).values(method).onConflictDoUpdate({
      target: paymentMethods.code,
      set: {
        name: method.name,
        kind: method.kind,
        currencyCode: method.currencyCode,
        isActive: method.isActive
      }
    }).run();
  }

  findByCode(code: string): Promise<PaymentMethod | null> {
    return read(() => {
      const row = this.handle.db.select().from(paymentMethods)
        .where(eq(paymentMethods.code, code)).get();
      return row ? PaymentMethod.create({ ...row, kind: row.kind as PaymentMethodKind }) : null;
    });
  }
}

export class DrizzleCashRegisterRepository implements CashRegisterRepository {
  constructor(private readonly handle: DatabaseHandle) {}

  async save(register: CashRegister): Promise<void> {
    requireTransaction(this.handle.sqlite);
    this.handle.db.insert(cashRegisters).values(register).onConflictDoUpdate({
      target: cashRegisters.id,
      set: {
        name: register.name,
        terminalId: register.terminalId,
        originNodeId: register.originNodeId,
        isActive: register.isActive
      }
    }).run();
  }

  findById(id: string): Promise<CashRegister | null> {
    return read(() => {
      const row = this.handle.db.select().from(cashRegisters)
        .where(eq(cashRegisters.id, id)).get();
      return row ? CashRegister.create(row) : null;
    });
  }
}

export class DrizzleExchangeRateRepository implements ExchangeRateRepository {
  constructor(private readonly handle: DatabaseHandle) {}

  async save(rate: ExchangeRate): Promise<void> {
    requireTransaction(this.handle.sqlite);
    this.handle.db.insert(exchangeRates).values({
      id: rate.id,
      baseCurrency: rate.baseCurrency,
      quoteCurrency: rate.quoteCurrency,
      rateValue: rate.rateValue,
      rateScale: rate.rateScale,
      source: rate.source,
      validFrom: rate.validFrom.getTime(),
      validUntil: rate.validUntil?.getTime() ?? null,
      registeredBy: rate.registeredBy
    }).run();
  }

  findById(id: string): Promise<ExchangeRate | null> {
    return read(() => this.restore(this.handle.db.select().from(exchangeRates)
      .where(eq(exchangeRates.id, id)).get()));
  }

  findCurrentByPair(base: string, quote: string, at: Date): Promise<ExchangeRate | null> {
    return read(() => this.restore(this.handle.db.select().from(exchangeRates).where(and(
      eq(exchangeRates.baseCurrency, base),
      eq(exchangeRates.quoteCurrency, quote),
      lte(exchangeRates.validFrom, at.getTime()),
      or(isNull(exchangeRates.validUntil), gt(exchangeRates.validUntil, at.getTime()))
    )).orderBy(desc(exchangeRates.validFrom)).get()));
  }

  private restore(row: typeof exchangeRates.$inferSelect | undefined): ExchangeRate | null {
    return row ? ExchangeRate.create({
      ...row,
      validFrom: new Date(row.validFrom),
      validUntil: row.validUntil === null ? null : new Date(row.validUntil)
    }) : null;
  }
}

export class DrizzleProductRepository implements ProductRepository {
  constructor(private readonly handle: DatabaseHandle) {}

  async save(product: Product): Promise<void> {
    requireTransaction(this.handle.sqlite);
    this.handle.db.insert(products).values({
      id: product.id,
      name: product.name,
      description: product.description,
      categoryId: product.categoryId,
      unitId: product.unitOfMeasure.id,
      priceMinorUnits: product.price.minorUnits,
      currencyCode: product.price.currency,
      taxRateBasisPoints: product.taxRate.basisPoints,
      isActive: product.isActive,
      version: product.version
    }).onConflictDoUpdate({
      target: products.id,
      set: {
        name: product.name,
        description: product.description,
        categoryId: product.categoryId,
        unitId: product.unitOfMeasure.id,
        priceMinorUnits: product.price.minorUnits,
        currencyCode: product.price.currency,
        taxRateBasisPoints: product.taxRate.basisPoints,
        isActive: product.isActive,
        version: product.version
      }
    }).run();
    this.handle.db.delete(productBarcodes).where(eq(productBarcodes.productId, product.id)).run();
    if (product.barcodes.length > 0) {
      this.handle.db.insert(productBarcodes).values(product.barcodes.map((barcode) => ({
        id: barcode.id,
        productId: product.id,
        value: barcode.value,
        isActive: barcode.isActive
      }))).run();
    }
    this.handle.db.delete(productPriceHistory)
      .where(eq(productPriceHistory.productId, product.id)).run();
    this.handle.db.insert(productPriceHistory).values(product.priceHistory.map((history) => ({
      id: history.id,
      productId: product.id,
      priceMinorUnits: history.price.minorUnits,
      currencyCode: history.price.currency,
      recordedAt: history.recordedAt.getTime(),
      recordedBy: history.recordedBy,
      reason: history.reason ?? ''
    }))).run();
  }

  findById(id: string): Promise<Product | null> {
    return read(() => this.restore(this.handle.db.select().from(products)
      .where(eq(products.id, id)).get()));
  }

  findByActiveBarcode(value: string): Promise<Product | null> {
    return read(() => {
      const barcode = this.handle.db.select().from(productBarcodes).where(and(
        eq(productBarcodes.value, value),
        eq(productBarcodes.isActive, true)
      )).get();
      return barcode ? this.restore(this.handle.db.select().from(products)
        .where(eq(products.id, barcode.productId)).get()) : null;
    });
  }

  private restore(row: typeof products.$inferSelect | undefined): Product | null {
    if (!row) return null;
    const unitRow = this.handle.db.select().from(unitsOfMeasure)
      .where(eq(unitsOfMeasure.id, row.unitId)).get();
    if (!unitRow) throw new Error('Persisted product unit is missing.');
    const barcodeRows = this.handle.db.select().from(productBarcodes)
      .where(eq(productBarcodes.productId, row.id)).all();
    const histories = this.handle.db.select().from(productPriceHistory)
      .where(eq(productPriceHistory.productId, row.id))
      .orderBy(productPriceHistory.recordedAt).all();
    return Product.restore({
      id: row.id,
      name: row.name,
      description: row.description,
      categoryId: row.categoryId,
      unitOfMeasure: UnitOfMeasure.create(unitRow),
      barcodes: barcodeRows.map((barcode) => Barcode.create(barcode)),
      price: Money.fromMinorUnits(row.priceMinorUnits, row.currencyCode),
      taxRate: TaxRate.fromBasisPoints(row.taxRateBasisPoints),
      priceHistory: histories.map((history) => PriceHistory.create({
        id: history.id,
        price: Money.fromMinorUnits(history.priceMinorUnits, history.currencyCode),
        recordedAt: new Date(history.recordedAt),
        recordedBy: history.recordedBy,
        reason: history.reason
      })),
      isActive: row.isActive,
      version: row.version
    });
  }
}

export class DrizzleSaleRepository implements SaleRepository {
  constructor(private readonly handle: DatabaseHandle) {}

  async save(sale: Sale): Promise<void> {
    requireTransaction(this.handle.sqlite);
    const existing = this.handle.db.select({ status: sales.status, version: sales.version })
      .from(sales).where(eq(sales.id, sale.id)).get();
    if (existing && existing.status !== 'DRAFT') {
      throw new InfrastructureError(
        'SALE_FINAL_STATE_IMMUTABLE',
        'A completed or voided sale cannot be overwritten.'
      );
    }
    if (existing && sale.version < existing.version) {
      throw new InfrastructureError('DATABASE_CONCURRENCY_CONFLICT', 'Sale version is stale.');
    }

    this.handle.db.insert(sales).values({
      id: sale.id,
      currencyCode: sale.currencyCode,
      terminalId: sale.terminalId,
      originNodeId: sale.originNodeId,
      startedBy: sale.startedBy,
      startedAt: sale.startedAt.getTime(),
      status: sale.status,
      version: sale.version,
      financialTransactionTaxMinorUnits: sale.financialTransactionTax.minorUnits,
      completedAt: sale.completedAt?.getTime() ?? null,
      voidedAt: sale.voidedAt?.getTime() ?? null,
      voidReason: sale.voidReason,
      voidedBy: sale.voidedBy
    }).onConflictDoUpdate({
      target: sales.id,
      set: {
        status: sale.status,
        version: sale.version,
        financialTransactionTaxMinorUnits: sale.financialTransactionTax.minorUnits,
        completedAt: sale.completedAt?.getTime() ?? null,
        voidedAt: sale.voidedAt?.getTime() ?? null,
        voidReason: sale.voidReason,
        voidedBy: sale.voidedBy
      }
    }).run();
    this.handle.db.delete(saleDiscounts).where(eq(saleDiscounts.saleId, sale.id)).run();
    this.handle.db.delete(saleItems).where(eq(saleItems.saleId, sale.id)).run();
    this.handle.db.delete(salePayments).where(eq(salePayments.saleId, sale.id)).run();

    if (sale.items.length > 0) {
      this.handle.db.insert(saleItems).values(sale.items.map((item) => ({
        id: item.id,
        saleId: sale.id,
        productId: item.snapshot.productId,
        description: item.snapshot.description,
        priceMinorUnits: item.snapshot.price.minorUnits,
        currencyCode: item.snapshot.price.currency,
        taxRateBasisPoints: item.snapshot.taxRate.basisPoints,
        unitCode: item.snapshot.unitCode,
        unitScale: item.snapshot.unitScale,
        quantityScaled: item.quantity.scaledValue,
        quantityScale: item.quantity.scale
      }))).run();
      const discounts = sale.items.flatMap((item) => item.discount ? [{
        id: item.discount.id,
        saleId: sale.id,
        itemId: item.id,
        percentageBasisPoints: item.discount.percentage.basisPoints,
        amountMinorUnits: item.discount.amount.minorUnits,
        currencyCode: item.discount.amount.currency,
        reason: item.discount.reason,
        appliedBy: item.discount.appliedBy,
        appliedAt: item.discount.appliedAt.getTime()
      }] : []);
      if (discounts.length > 0) this.handle.db.insert(saleDiscounts).values(discounts).run();
    }
    if (sale.payments.length > 0) {
      this.handle.db.insert(salePayments).values(sale.payments.map((payment) => ({
        id: payment.id,
        saleId: sale.id,
        paymentMethodCode: payment.method.code,
        paymentMethodName: payment.method.name,
        paymentMethodKind: payment.method.kind,
        amountMinorUnits: payment.amount.minorUnits,
        currencyCode: payment.amount.currency,
        amountInSaleCurrencyMinorUnits: payment.amountInSaleCurrency.minorUnits,
        saleCurrencyCode: payment.amountInSaleCurrency.currency,
        exchangeRateId: payment.exchangeRate?.id ?? null,
        exchangeRateBaseCurrency: payment.exchangeRate?.baseCurrency ?? null,
        exchangeRateQuoteCurrency: payment.exchangeRate?.quoteCurrency ?? null,
        exchangeRateValue: payment.exchangeRate?.rateValue ?? null,
        exchangeRateScale: payment.exchangeRate?.rateScale ?? null,
        exchangeRateSource: payment.exchangeRate?.source ?? null,
        exchangeRateValidFrom: payment.exchangeRate?.validFrom.getTime() ?? null,
        exchangeRateValidUntil: payment.exchangeRate?.validUntil?.getTime() ?? null,
        exchangeRateRegisteredBy: payment.exchangeRate?.registeredBy ?? null,
        registeredBy: payment.registeredBy,
        registeredAt: payment.registeredAt.getTime()
      }))).run();
    }
  }

  findById(id: string): Promise<Sale | null> {
    return read(() => {
      const row = this.handle.db.select().from(sales).where(eq(sales.id, id)).get();
      if (!row) return null;
      const itemRows = this.handle.db.select().from(saleItems)
        .where(eq(saleItems.saleId, id)).all();
      const discountRows = this.handle.db.select().from(saleDiscounts)
        .where(eq(saleDiscounts.saleId, id)).all();
      const discountsByItem = new Map(discountRows.map((discount) => [discount.itemId, discount]));
      const items = itemRows.map((item) => {
        const discount = discountsByItem.get(item.id);
        return SaleItem.restore({
          id: item.id,
          snapshot: ProductSnapshot.create({
            productId: item.productId,
            description: item.description,
            price: Money.fromMinorUnits(item.priceMinorUnits, item.currencyCode),
            taxRate: TaxRate.fromBasisPoints(item.taxRateBasisPoints),
            unitCode: item.unitCode,
            unitScale: item.unitScale
          }),
          quantity: Quantity.fromScaled(item.quantityScaled, item.quantityScale),
          discount: discount ? Discount.create({
            id: discount.id,
            lineItemId: item.id,
            percentage: Percentage.fromBasisPoints(discount.percentageBasisPoints),
            amount: Money.fromMinorUnits(discount.amountMinorUnits, discount.currencyCode),
            reason: discount.reason,
            appliedBy: discount.appliedBy,
            appliedAt: new Date(discount.appliedAt)
          }) : null
        });
      });
      const payments = this.handle.db.select().from(salePayments)
        .where(eq(salePayments.saleId, id)).all().map((payment) => Payment.create({
          id: payment.id,
          method: PaymentMethod.create({
            code: payment.paymentMethodCode,
            name: payment.paymentMethodName,
            kind: payment.paymentMethodKind as PaymentMethodKind,
            currencyCode: payment.currencyCode
          }),
          amount: Money.fromMinorUnits(payment.amountMinorUnits, payment.currencyCode),
          amountInSaleCurrency: Money.fromMinorUnits(
            payment.amountInSaleCurrencyMinorUnits,
            payment.saleCurrencyCode
          ),
          exchangeRate: this.restorePaymentRate(payment),
          registeredBy: payment.registeredBy,
          registeredAt: new Date(payment.registeredAt)
        }));
      return Sale.restore({
        id: row.id,
        currencyCode: row.currencyCode,
        terminalId: row.terminalId,
        originNodeId: row.originNodeId,
        startedBy: row.startedBy,
        startedAt: new Date(row.startedAt),
        status: row.status as Parameters<typeof Sale.restore>[0]['status'],
        version: row.version,
        items,
        payments,
        financialTransactionTax: Money.fromMinorUnits(
          row.financialTransactionTaxMinorUnits,
          row.currencyCode
        ),
        completedAt: row.completedAt === null ? null : new Date(row.completedAt),
        voidedAt: row.voidedAt === null ? null : new Date(row.voidedAt),
        voidReason: row.voidReason,
        voidedBy: row.voidedBy
      });
    });
  }

  private restorePaymentRate(
    row: typeof salePayments.$inferSelect
  ): ExchangeRate | null {
    if (row.exchangeRateId === null) return null;
    if (
      row.exchangeRateBaseCurrency === null || row.exchangeRateQuoteCurrency === null ||
      row.exchangeRateValue === null || row.exchangeRateScale === null ||
      row.exchangeRateSource === null || row.exchangeRateValidFrom === null ||
      row.exchangeRateRegisteredBy === null
    ) throw new Error('Persisted payment exchange-rate snapshot is incomplete.');
    return ExchangeRate.create({
      id: row.exchangeRateId,
      baseCurrency: row.exchangeRateBaseCurrency,
      quoteCurrency: row.exchangeRateQuoteCurrency,
      rateValue: row.exchangeRateValue,
      rateScale: row.exchangeRateScale,
      source: row.exchangeRateSource,
      validFrom: new Date(row.exchangeRateValidFrom),
      validUntil: row.exchangeRateValidUntil === null
        ? null
        : new Date(row.exchangeRateValidUntil),
      registeredBy: row.exchangeRateRegisteredBy
    });
  }
}

export class DrizzleShiftRepository implements ShiftRepository {
  constructor(private readonly handle: DatabaseHandle) {}

  async save(shift: Shift): Promise<void> {
    requireTransaction(this.handle.sqlite);
    const existing = this.handle.db.select({ status: shifts.status, version: shifts.version })
      .from(shifts).where(eq(shifts.id, shift.id)).get();
    if (existing?.status === 'CLOSED') {
      throw new InfrastructureError(
        'SHIFT_FINAL_STATE_IMMUTABLE',
        'A closed shift cannot be overwritten.'
      );
    }
    if (existing && shift.version < existing.version) {
      throw new InfrastructureError('DATABASE_CONCURRENCY_CONFLICT', 'Shift version is stale.');
    }
    this.handle.db.insert(shifts).values({
      id: shift.id,
      cashRegisterId: shift.cashRegisterId,
      terminalId: shift.terminalId,
      originNodeId: shift.originNodeId,
      openedBy: shift.openedBy,
      openedAt: shift.openedAt.getTime(),
      status: shift.status,
      version: shift.version,
      closedAt: shift.closedAt?.getTime() ?? null,
      closedBy: shift.closedBy
    }).onConflictDoUpdate({
      target: shifts.id,
      set: {
        status: shift.status,
        version: shift.version,
        closedAt: shift.closedAt?.getTime() ?? null,
        closedBy: shift.closedBy
      }
    }).run();
    this.handle.db.delete(cashMovements).where(eq(cashMovements.shiftId, shift.id)).run();
    if (shift.movements.length > 0) {
      this.handle.db.insert(cashMovements).values(shift.movements.map((movement) => ({
        id: movement.id,
        shiftId: shift.id,
        type: movement.type,
        paymentMethodCode: movement.method.code,
        paymentMethodName: movement.method.name,
        paymentMethodKind: movement.method.kind,
        amountMinorUnits: movement.amount.minorUnits,
        currencyCode: movement.amount.currency,
        reason: movement.reason,
        registeredBy: movement.registeredBy,
        registeredAt: movement.registeredAt.getTime()
      }))).run();
    }
    this.handle.db.delete(shiftClosingBalances)
      .where(eq(shiftClosingBalances.shiftId, shift.id)).run();
    if (shift.closingBalances && shift.closingBalances.length > 0) {
      this.handle.db.insert(shiftClosingBalances).values(shift.closingBalances.map((balance) => ({
        shiftId: shift.id,
        paymentMethodCode: balance.paymentMethodCode,
        currencyCode: balance.expected.currency,
        expectedMinorUnits: balance.expected.minorUnits,
        declaredMinorUnits: balance.declared.minorUnits,
        differenceMinorUnits: balance.difference.minorUnits
      }))).run();
    }
  }

  findById(id: string): Promise<Shift | null> {
    return read(() => this.restore(this.handle.db.select().from(shifts)
      .where(eq(shifts.id, id)).get()));
  }

  findOpenByCashRegisterId(id: string): Promise<Shift | null> {
    return read(() => this.restore(this.handle.db.select().from(shifts).where(and(
      eq(shifts.cashRegisterId, id), eq(shifts.status, 'OPEN')
    )).get()));
  }

  private restore(row: typeof shifts.$inferSelect | undefined): Shift | null {
    if (!row) return null;
    const movementRows = this.handle.db.select().from(cashMovements)
      .where(eq(cashMovements.shiftId, row.id)).orderBy(cashMovements.registeredAt).all();
    const balanceRows = this.handle.db.select().from(shiftClosingBalances)
      .where(eq(shiftClosingBalances.shiftId, row.id)).all();
    return Shift.restore({
      id: row.id,
      cashRegisterId: row.cashRegisterId,
      terminalId: row.terminalId,
      originNodeId: row.originNodeId,
      openedBy: row.openedBy,
      openedAt: new Date(row.openedAt),
      movements: movementRows.map((movement) => CashMovement.create({
        id: movement.id,
        type: movement.type as Parameters<typeof CashMovement.create>[0]['type'],
        method: PaymentMethod.create({
          code: movement.paymentMethodCode,
          name: movement.paymentMethodName,
          kind: movement.paymentMethodKind as PaymentMethodKind,
          currencyCode: movement.currencyCode
        }),
        amount: Money.fromMinorUnits(movement.amountMinorUnits, movement.currencyCode),
        reason: movement.reason,
        registeredBy: movement.registeredBy,
        registeredAt: new Date(movement.registeredAt)
      })),
      status: row.status as Parameters<typeof Shift.restore>[0]['status'],
      version: row.version,
      closingBalances: balanceRows.length === 0 ? null : balanceRows.map((balance) => ({
        paymentMethodCode: balance.paymentMethodCode,
        expected: Money.fromMinorUnits(balance.expectedMinorUnits, balance.currencyCode),
        declared: Money.fromMinorUnits(balance.declaredMinorUnits, balance.currencyCode),
        difference: Money.fromMinorUnits(balance.differenceMinorUnits, balance.currencyCode)
      })),
      closedAt: row.closedAt === null ? null : new Date(row.closedAt),
      closedBy: row.closedBy
    });
  }
}
