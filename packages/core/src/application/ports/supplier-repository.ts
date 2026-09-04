import type { Supplier, SupplierStatus } from '../../domain/purchasing/index.js';

export interface SupplierRepository {
  nextCode(): Promise<string>;
  save(supplier: Supplier): Promise<void>;
  findById(supplierId: string): Promise<Supplier | null>;
  findByTaxIdentity(
    country: string,
    type: string,
    normalizedValue: string
  ): Promise<Supplier | null>;
  findAll(status?: SupplierStatus): Promise<readonly Supplier[]>;
}

