import { ApplicationError, err, ok, type Result } from '@supermarket/shared';
import type { PaymentMethod } from '../../domain/currency/index.js';
import type { PaymentMethodRepository } from '../ports/index.js';

export async function resolveCashPaymentMethod(
  repository: PaymentMethodRepository,
  code: string,
  currencyCode: string
): Promise<Result<PaymentMethod, ApplicationError>> {
  const method = await repository.findByCode(code.trim().toUpperCase());
  if (method === null) {
    return err(new ApplicationError('PAYMENT_METHOD_NOT_FOUND', 'Payment method was not found.'));
  }
  if (!method.isActive) {
    return err(new ApplicationError('PAYMENT_METHOD_INACTIVE', 'Payment method is inactive.'));
  }
  if (method.kind !== 'CASH') {
    return err(new ApplicationError('CASH_PAYMENT_METHOD_REQUIRED', 'Cash operations require a cash method.'));
  }
  if (method.currencyCode !== currencyCode) {
    return err(new ApplicationError(
      'PAYMENT_METHOD_CURRENCY_MISMATCH',
      'Payment method currency must match the provided currency.'
    ));
  }
  return ok(method);
}
