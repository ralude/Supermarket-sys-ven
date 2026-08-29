# @supermarket/driver-db

Driver de persistencia para SQLite y Drizzle. Aisla `better-sqlite3`, verifica los pragmas requeridos y administra migraciones forward-only.

## Uso actual

`openDatabase(path)` devuelve la conexion SQLite, el cliente Drizzle y una funcion `close`. La configuracion aplica y verifica WAL, foreign keys, busy timeout y synchronous NORMAL. Para archivos reales tambien adquiere un lock de ownership single-writer, recupera locks de procesos terminados y lo libera al cerrar.

La base `:memory:` se admite para pruebas; SQLite no puede usar WAL en memoria, por lo que esa verificacion se omite solo para ese path.

`migrateDatabase(path, options)` registra checksums en `schema_migrations`. Para bases existentes crea primero un respaldo consistente en `backupDirectory`, valida integridad y claves foraneas, y restaura ese archivo si la migracion o la validacion de arranque falla. La retencion predeterminada es de cinco respaldos. El rollback operativo siempre usa el respaldo; las migraciones aplicadas no se revierten con scripts `down`.

## Repositorios y transacciones

Los adaptadores Drizzle implementan los puertos publicos de configuracion, tasas, productos, ventas y turnos. Toda escritura debe ejecutarse mediante `SqliteUnitOfWork`; los repositorios rechazan escrituras fuera de `BEGIN IMMEDIATE -> guardar -> COMMIT` y traducen fallas SQLite a `InfrastructureError` estable.

Las consultas rehidratan agregados sin regenerar eventos de dominio. Los estados finales de ventas y turnos son inmutables y los snapshots comerciales permanecen asociados a la venta.

## Limites actuales

El ledger, outbox, auditoria e idempotencia pertenecen a la Fase 4. La persistencia de identidad y el inventario operativo se incorporan en las fases definidas por el cronograma.

Solo el proceso Fastify/servidor debe abrir el archivo SQLite. El renderer y Electron no acceden directamente a la base.

El uso del driver dentro de un proceso Electron requerira revisar el rebuild de ABI nativa durante el empaquetado standalone. Esta fase ejecuta el driver bajo Node.
