import type { Shift } from '../../domain/cash/index.js';
import type { ShiftDto } from './dtos.js';

export function toShiftDto(shift: Shift): ShiftDto {
  return {
    id: shift.id,
    cashRegisterId: shift.cashRegisterId,
    terminalId: shift.terminalId,
    originNodeId: shift.originNodeId,
    status: shift.status,
    version: shift.version,
    openedBy: shift.openedBy,
    openedAt: shift.openedAt,
    closedBy: shift.closedBy,
    closedAt: shift.closedAt,
    movements: shift.movements.map((movement) => ({
      id: movement.id,
      type: movement.type,
      paymentMethodCode: movement.method.code,
      currencyCode: movement.amount.currency,
      amountMinorUnits: movement.amount.minorUnits,
      reason: movement.reason,
      registeredBy: movement.registeredBy,
      registeredAt: movement.registeredAt
    })),
    expectedBalances: shift.expectedBalances.map((balance) => ({
      paymentMethodCode: balance.paymentMethodCode,
      currencyCode: balance.amount.currency,
      minorUnits: balance.amount.minorUnits
    })),
    closingBalances: shift.closingBalances?.map((balance) => ({
      paymentMethodCode: balance.paymentMethodCode,
      currencyCode: balance.expected.currency,
      expectedMinorUnits: balance.expected.minorUnits,
      declaredMinorUnits: balance.declared.minorUnits,
      differenceMinorUnits: balance.difference.minorUnits
    })) ?? null
  };
}
