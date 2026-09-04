import { describe, expect, it } from 'vitest';
import { Supplier } from '@supermarket/core';
import { openDatabase } from './connection.js';
import { applyMigrations } from './migrations.js';
import { DrizzleSupplierRepository } from './supplier-repository.js';
import { SqliteUnitOfWork } from './unit-of-work.js';

const create = (id: string, code: string, value: string): Supplier => Supplier.create({
  id, code, legalName: `Proveedor ${id}`, tradeName: 'Comercial',
  fiscalAddress: { countryCode: 'VE', addressLine: 'Caracas' },
  taxIdentity: { country: 'VE', type: 'RIF', value },
  createdAt: new Date('2026-09-04T12:00:00Z')
});

describe('DrizzleSupplierRepository', () => {
  it('round-trips state, timestamps and version and lists by status', async () => {
    const handle = openDatabase(':memory:');
    applyMigrations(handle.sqlite);
    const repository = new DrizzleSupplierRepository(handle);
    const uow = new SqliteUnitOfWork(handle.sqlite);
    const supplier = create('supplier-1', 'SUP-000001', 'J-12345678-9');
    await uow.execute(() => repository.save(supplier));
    supplier.changeStatus('BLOCKED', new Date('2026-09-04T13:00:00Z'));
    await uow.execute(() => repository.save(supplier));

    expect(await repository.findById(supplier.id)).toMatchObject({
      id: supplier.id, code: 'SUP-000001', legalName: 'Proveedor supplier-1',
      status: 'BLOCKED', version: 2
    });
    expect((await repository.findAll('ACTIVE'))).toHaveLength(0);
    expect((await repository.findAll('BLOCKED')).map(({ id }) => id)).toEqual([supplier.id]);
    handle.close();
  });

  it('generates codes transactionally and rejects duplicate code and normalized identity', async () => {
    const handle = openDatabase(':memory:');
    applyMigrations(handle.sqlite);
    const repository = new DrizzleSupplierRepository(handle);
    const uow = new SqliteUnitOfWork(handle.sqlite);
    expect(await uow.execute(() => repository.nextCode())).toBe('SUP-000001');
    expect(await uow.execute(() => repository.nextCode())).toBe('SUP-000002');

    await uow.execute(() => repository.save(create('supplier-1', 'SUP-000003', 'J-12345678-9')));
    await expect(uow.execute(() => repository.save(
      create('supplier-2', 'SUP-000003', 'J-12345677-0')
    ))).rejects.toMatchObject({ code: 'DATABASE_CONSTRAINT_VIOLATION' });
    await expect(uow.execute(() => repository.save(
      create('supplier-3', 'SUP-000004', 'j123456789')
    ))).rejects.toMatchObject({ code: 'DATABASE_CONSTRAINT_VIOLATION' });
    expect(() => handle.sqlite.prepare("delete from suppliers where id = 'supplier-1'").run())
      .toThrowError('suppliers cannot be deleted');
    handle.close();
  });
});

