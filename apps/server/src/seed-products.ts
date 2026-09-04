import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { stdout } from 'node:process';
import { Barcode, Category, Product, UnitOfMeasure } from '@supermarket/core';
import {
  applyMigrations,
  DrizzleCategoryRepository,
  DrizzleProductRepository,
  DrizzleUnitOfMeasureRepository,
  openDatabase,
  SqliteUnitOfWork,
  type DatabaseHandle
} from '@supermarket/driver-db';
import { Money, TaxRate } from '@supermarket/shared';

export type ExampleProductSeedOptions = {
  readonly currencyCode: string;
  readonly taxRateBasisPoints: number;
};

export type ExampleProductSeedResult = {
  readonly categories: number;
  readonly unitsOfMeasure: number;
  readonly products: number;
};

type ProductDefinition = {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly categoryId: string;
  readonly barcodeId: string;
  readonly barcode: string;
  readonly priceMinorUnits: number;
  readonly priceHistoryId: string;
  readonly eventId: string;
};

const RECORDED_AT = new Date('2026-09-02T00:00:00.000Z');
const RECORDED_BY = 'seed:example-products';
const UNIT_ID = '0199a0f0-0000-7000-8000-000000000010';

const CATEGORIES = [
  Category.create({
    id: '0199a0f0-0000-7000-8000-000000000001',
    name: 'Alimentos básicos'
  }),
  Category.create({
    id: '0199a0f0-0000-7000-8000-000000000002',
    name: 'Bebidas'
  }),
  Category.create({
    id: '0199a0f0-0000-7000-8000-000000000003',
    name: 'Lácteos'
  })
] as const;

const UNIT = UnitOfMeasure.create({
  id: UNIT_ID,
  code: 'UN',
  name: 'Unidad',
  quantityScale: 0
});

const PRODUCT_DEFINITIONS: readonly ProductDefinition[] = [
  {
    id: '0199a0f0-0000-7000-8000-000000001001',
    name: 'Arroz blanco 1 kg',
    description: 'Paquete de arroz blanco de 1 kilogramo',
    categoryId: CATEGORIES[0].id,
    barcodeId: '0199a0f0-0000-7000-8000-000000002001',
    barcode: 'DEMOARROZ001',
    priceMinorUnits: 180,
    priceHistoryId: '0199a0f0-0000-7000-8000-000000003001',
    eventId: '0199a0f0-0000-7000-8000-000000004001'
  },
  {
    id: '0199a0f0-0000-7000-8000-000000001002',
    name: 'Harina de maíz 1 kg',
    description: 'Paquete de harina de maíz precocida de 1 kilogramo',
    categoryId: CATEGORIES[0].id,
    barcodeId: '0199a0f0-0000-7000-8000-000000002002',
    barcode: 'DEMOHARINA001',
    priceMinorUnits: 140,
    priceHistoryId: '0199a0f0-0000-7000-8000-000000003002',
    eventId: '0199a0f0-0000-7000-8000-000000004002'
  },
  {
    id: '0199a0f0-0000-7000-8000-000000001003',
    name: 'Café molido 250 g',
    description: 'Paquete de café molido de 250 gramos',
    categoryId: CATEGORIES[0].id,
    barcodeId: '0199a0f0-0000-7000-8000-000000002003',
    barcode: 'DEMOCAFE001',
    priceMinorUnits: 450,
    priceHistoryId: '0199a0f0-0000-7000-8000-000000003003',
    eventId: '0199a0f0-0000-7000-8000-000000004003'
  },
  {
    id: '0199a0f0-0000-7000-8000-000000001004',
    name: 'Agua mineral 1 L',
    description: 'Botella de agua mineral de 1 litro',
    categoryId: CATEGORIES[1].id,
    barcodeId: '0199a0f0-0000-7000-8000-000000002004',
    barcode: 'DEMOAGUA001',
    priceMinorUnits: 100,
    priceHistoryId: '0199a0f0-0000-7000-8000-000000003004',
    eventId: '0199a0f0-0000-7000-8000-000000004004'
  },
  {
    id: '0199a0f0-0000-7000-8000-000000001005',
    name: 'Leche UHT 1 L',
    description: 'Envase de leche de larga duración de 1 litro',
    categoryId: CATEGORIES[2].id,
    barcodeId: '0199a0f0-0000-7000-8000-000000002005',
    barcode: 'DEMOLECHE001',
    priceMinorUnits: 250,
    priceHistoryId: '0199a0f0-0000-7000-8000-000000003005',
    eventId: '0199a0f0-0000-7000-8000-000000004005'
  }
];

export const seedExampleProducts = async (
  handle: DatabaseHandle,
  options: ExampleProductSeedOptions
): Promise<ExampleProductSeedResult> => {
  const currencyCode = options.currencyCode.trim().toUpperCase();
  const taxRate = TaxRate.fromBasisPoints(options.taxRateBasisPoints);
  const products = PRODUCT_DEFINITIONS.map((definition) => Product.create({
    id: definition.id,
    name: definition.name,
    description: definition.description,
    categoryId: definition.categoryId,
    unitOfMeasure: UNIT,
    barcodes: [Barcode.create({ id: definition.barcodeId, value: definition.barcode })],
    price: Money.fromMinorUnits(definition.priceMinorUnits, currencyCode),
    taxRate,
    priceHistoryId: definition.priceHistoryId,
    recordedBy: RECORDED_BY,
    occurredAt: RECORDED_AT,
    eventId: definition.eventId
  }));
  const unitOfWork = new SqliteUnitOfWork(handle.sqlite);
  const categoryRepository = new DrizzleCategoryRepository(handle);
  const unitRepository = new DrizzleUnitOfMeasureRepository(handle);
  const productRepository = new DrizzleProductRepository(handle);

  await unitOfWork.execute(async () => {
    for (const category of CATEGORIES) await categoryRepository.save(category);
    await unitRepository.save(UNIT);
    for (const product of products) await productRepository.save(product);
  });

  return {
    categories: CATEGORIES.length,
    unitsOfMeasure: 1,
    products: products.length
  };
};

type CliOptions = ExampleProductSeedOptions & { readonly databasePath: string };

const readRequiredOption = (args: readonly string[], name: string): string => {
  const index = args.indexOf(name);
  const value = index === -1 ? undefined : args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`Falta la opción requerida ${name}.`);
  return value;
};

const parseCliOptions = (args: readonly string[]): CliOptions => {
  const databasePath = readRequiredOption(args, '--database').trim();
  if (databasePath === ':memory:') {
    throw new Error('El comando requiere una base persistente; :memory: no está permitido.');
  }
  const currencyCode = readRequiredOption(args, '--currency').trim().toUpperCase();
  const taxRateText = readRequiredOption(args, '--tax-rate-basis-points');
  const taxRateBasisPoints = Number(taxRateText);
  if (!Number.isSafeInteger(taxRateBasisPoints) || taxRateBasisPoints < 0) {
    throw new Error('La tasa debe ser un entero no negativo expresado en puntos base.');
  }
  return { databasePath, currencyCode, taxRateBasisPoints };
};

export const runSeedProductsCli = async (args: readonly string[]): Promise<void> => {
  let handle: DatabaseHandle | undefined;
  try {
    const options = parseCliOptions(args);
    handle = openDatabase(resolve(options.databasePath));
    applyMigrations(handle.sqlite);
    const result = await seedExampleProducts(handle, options);
    stdout.write(
      `Seed listo: ${result.products} productos, ${result.categories} categorías y ` +
      `${result.unitsOfMeasure} unidad de medida.\n`
    );
  } catch (error) {
    stdout.write(
      `No se pudo generar el catálogo de ejemplo: ` +
      `${error instanceof Error ? error.message : 'error desconocido'}\n` +
      'Uso: pnpm seed:products -- --database <ruta> --currency <ABC> ' +
      '--tax-rate-basis-points <entero>\n'
    );
    process.exitCode = 1;
  } finally {
    handle?.close();
  }
};

const isMainModule = process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainModule) await runSeedProductsCli(process.argv.slice(2));
