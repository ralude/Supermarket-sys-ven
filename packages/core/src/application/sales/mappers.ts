import type { FiscalDocument } from '../../domain/fiscal/index.js';
import type { Sale } from '../../domain/sales/index.js';
import type { SaleReturn } from '../../domain/sales/index.js';
import type { SaleDto, SaleReturnDto } from './dtos.js';

export function toSaleDto(sale: Sale): SaleDto {
  return {
    id: sale.id,
    shiftId: sale.shiftId,
    currencyCode: sale.currencyCode,
    terminalId: sale.terminalId,
    originNodeId: sale.originNodeId,
    status: sale.status,
    version: sale.version,
    items: sale.items.map((item) => ({
      id: item.id,
      productId: item.snapshot.productId,
      description: item.snapshot.description,
      quantityScaled: item.quantity.scaledValue,
      quantityScale: item.quantity.scale,
      unitCode: item.snapshot.unitCode,
      grossMinorUnits: item.grossAmount.minorUnits,
      discountMinorUnits: item.discountAmount.minorUnits,
      taxableMinorUnits: item.taxableAmount.minorUnits,
      taxMinorUnits: item.taxAmount.minorUnits,
      totalMinorUnits: item.total.minorUnits,
      discountBasisPoints: item.discount?.percentage.basisPoints ?? null
    })),
    payments: sale.payments.map((payment) => ({
      id: payment.id,
      methodCode: payment.method.code,
      methodKind: payment.method.kind,
      currencyCode: payment.amount.currency,
      amountMinorUnits: payment.amount.minorUnits,
      amountInSaleCurrencyMinorUnits: payment.amountInSaleCurrency.minorUnits,
      exchangeRateId: payment.exchangeRate?.id ?? null
    })),
    subtotalMinorUnits: sale.subtotal.minorUnits,
    discountTotalMinorUnits: sale.discountTotal.minorUnits,
    taxableBaseMinorUnits: sale.taxableBase.minorUnits,
    taxTotalMinorUnits: sale.taxTotal.minorUnits,
    financialTransactionTaxMinorUnits: sale.financialTransactionTax.minorUnits,
    totalMinorUnits: sale.total.minorUnits,
    paidTotalMinorUnits: sale.paidTotal.minorUnits,
    balanceMinorUnits: sale.balance.minorUnits,
    completedAt: sale.completedAt,
    voidedAt: sale.voidedAt,
    voidReason: sale.voidReason,
    recipient: sale.recipient
  };
}

export function toSaleReturnDto(saleReturn: SaleReturn, creditNote: FiscalDocument): SaleReturnDto {
  return {
    id: saleReturn.id,
    saleId: saleReturn.saleId,
    originalDocumentId: saleReturn.originalDocumentId,
    creditNoteId: saleReturn.creditNoteId,
    creditNoteStatus: creditNote.status,
    creditNoteFiscalNumber: creditNote.fiscalNumber,
    shiftId: saleReturn.shiftId,
    refundMinorUnits: saleReturn.refund.minorUnits,
    currencyCode: saleReturn.refund.currency,
    paymentMethodCode: saleReturn.paymentMethodCode,
    reason: saleReturn.reason,
    occurredAt: new Date(saleReturn.occurredAt),
    lines: saleReturn.lines.map((line) => ({
      id: line.id,
      saleItemId: line.saleItemId,
      productId: line.productId,
      stockItemId: line.stockItemId,
      batchId: line.batchId,
      quantityScaled: line.quantity.scaledValue,
      quantityScale: line.quantity.scale,
      unitCostMinorUnits: line.unitCost?.minorUnits ?? null,
      costCurrencyCode: line.unitCost?.currency ?? null
    }))
  };
}
