import type { PaymentMethod } from '../../domain/currency/index.js';

/** Los métodos concretos se configuran fuera del agregado Sale. */
export interface PaymentMethodRepository {
  findByCode(code: string): Promise<PaymentMethod | null>;
  findAll(): Promise<readonly PaymentMethod[]>;
}
