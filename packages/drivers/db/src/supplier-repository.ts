import { Supplier, type SupplierRepository, type SupplierStatus } from '@supermarket/core';
import { InfrastructureError } from '@supermarket/shared';
import { and, asc, eq } from 'drizzle-orm';
import type { DatabaseHandle } from './connection.js';
import { suppliers } from './schema.js';
import { mapDatabaseError, requireTransaction } from './unit-of-work.js';

export class DrizzleSupplierRepository implements SupplierRepository {
  constructor(private readonly handle: DatabaseHandle) {}

  async nextCode(): Promise<string> {
    requireTransaction(this.handle.sqlite);
    const value = this.handle.sqlite.prepare(`
      update supplier_code_sequence set last_value = last_value + 1 where id = 1
      returning last_value
    `).pluck().get();
    if (typeof value !== 'number') {
      throw new InfrastructureError('DATABASE_OPERATION_FAILED', 'Supplier code could not be generated.');
    }
    return `SUP-${String(value).padStart(6, '0')}`;
  }

  async save(supplier: Supplier): Promise<void> {
    requireTransaction(this.handle.sqlite);
    try {
      const existing = this.handle.db.select({ version: suppliers.version })
        .from(suppliers).where(eq(suppliers.id, supplier.id)).get();
      const values = {
        legalName: supplier.legalName,
        tradeName: supplier.tradeName,
        fiscalAddressCountry: supplier.fiscalAddress?.countryCode ?? null,
        fiscalAddressLine: supplier.fiscalAddress?.addressLine ?? null,
        taxCountry: supplier.taxIdentity.country,
        taxType: supplier.taxIdentity.type,
        taxValue: supplier.taxIdentity.value,
        taxNormalizedValue: supplier.taxIdentity.normalizedValue,
        status: supplier.status,
        updatedAt: supplier.updatedAt,
        version: supplier.version
      };
      if (!existing) {
        this.handle.db.insert(suppliers).values({
          id: supplier.id, code: supplier.code, createdAt: supplier.createdAt, ...values
        }).run();
        return;
      }
      if (existing.version !== supplier.version - 1) {
        throw new InfrastructureError('DATABASE_CONCURRENCY_CONFLICT', 'Supplier version is stale.');
      }
      const changed = this.handle.db.update(suppliers).set(values).where(and(
        eq(suppliers.id, supplier.id), eq(suppliers.version, existing.version)
      )).run();
      if (changed.changes !== 1) {
        throw new InfrastructureError('DATABASE_CONCURRENCY_CONFLICT', 'Supplier version is stale.');
      }
    } catch (error) {
      throw mapDatabaseError(error);
    }
  }

  async findById(id: string): Promise<Supplier | null> {
    try {
      return this.restore(this.handle.db.select().from(suppliers).where(eq(suppliers.id, id)).get());
    } catch (error) {
      throw mapDatabaseError(error);
    }
  }

  async findByTaxIdentity(country: string, type: string, normalizedValue: string): Promise<Supplier | null> {
    try {
      return this.restore(this.handle.db.select().from(suppliers).where(and(
        eq(suppliers.taxCountry, country), eq(suppliers.taxType, type),
        eq(suppliers.taxNormalizedValue, normalizedValue)
      )).get());
    } catch (error) {
      throw mapDatabaseError(error);
    }
  }

  async findAll(status?: SupplierStatus): Promise<readonly Supplier[]> {
    try {
      const rows = status === undefined
        ? this.handle.db.select().from(suppliers).orderBy(asc(suppliers.code)).all()
        : this.handle.db.select().from(suppliers).where(eq(suppliers.status, status))
          .orderBy(asc(suppliers.code)).all();
      return rows.map((row) => this.restore(row) as Supplier);
    } catch (error) {
      throw mapDatabaseError(error);
    }
  }

  private restore(row: typeof suppliers.$inferSelect | undefined): Supplier | null {
    return row ? Supplier.restore({
      id: row.id, code: row.code, legalName: row.legalName,
      tradeName: row.tradeName,
      fiscalAddress: row.fiscalAddressCountry !== null && row.fiscalAddressLine !== null
        ? { countryCode: row.fiscalAddressCountry, addressLine: row.fiscalAddressLine }
        : null,
      taxIdentity: {
        country: row.taxCountry, type: row.taxType,
        value: row.taxValue, normalizedValue: row.taxNormalizedValue
      },
      status: row.status as SupplierStatus,
      createdAt: row.createdAt, updatedAt: row.updatedAt, version: row.version
    }) : null;
  }
}

