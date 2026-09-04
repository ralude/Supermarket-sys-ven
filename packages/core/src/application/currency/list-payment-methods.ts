import { ok, type Result, type AppError } from '@supermarket/shared';
import type { PaymentMethodRepository } from '../ports/index.js';
import type { PaymentMethodDto } from './dtos.js';

/**
 * Lista los métodos de pago activos para que la interfaz los ofrezca como
 * selector, con la moneda de liquidación que cada uno ya declara.
 */
export class ListPaymentMethods {
  constructor(private readonly repository: PaymentMethodRepository) {}

  async execute(): Promise<Result<readonly PaymentMethodDto[], AppError>> {
    const methods = await this.repository.findAll();
    return ok(methods
      .filter((method) => method.isActive)
      .map((method) => ({
        code: method.code, name: method.name, kind: method.kind, currencyCode: method.currencyCode
      })));
  }
}
