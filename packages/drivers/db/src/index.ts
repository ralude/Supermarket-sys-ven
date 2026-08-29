export { openDatabase } from './connection.js';
export type { DatabaseHandle } from './connection.js';
export { applyMigrations, migrateDatabase, migrations } from './migrations.js';
export type { Migration, MigrationOptions, MigrationResult } from './migrations.js';
export { mapDatabaseError, requireTransaction, SqliteUnitOfWork } from './unit-of-work.js';
export {
  DrizzleCashRegisterRepository,
  DrizzleCategoryRepository,
  DrizzleExchangeRateRepository,
  DrizzlePaymentMethodRepository,
  DrizzleProductRepository,
  DrizzleSaleRepository,
  DrizzleShiftRepository,
  DrizzleUnitOfMeasureRepository
} from './repositories.js';
