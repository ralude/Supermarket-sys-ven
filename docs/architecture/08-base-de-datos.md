# 08. Base de datos

## Decisiones

- SQLite como base local por nodo servidor.
- Drizzle como ORM y capa de mapeo.
- `better-sqlite3` como driver inicial por su operación síncrona y predecible en un proceso local.
- WAL para permitir lecturas concurrentes durante escrituras.
- Solo el proceso Fastify/servidor abre el archivo de base de datos.
- Cada archivo adquiere un lock de ownership del nodo; otro proceso que use el driver no puede abrirlo hasta que el dueño cierre o el proceso deje de existir.
- Las tablas relacionales de agregados son la fuente de verdad del estado operativo; el ledger no se usa para rehidratar agregados al arrancar.

## Pragmas requeridos

```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;
PRAGMA synchronous = NORMAL;
```

La configuración se ejecuta y verifica al abrir la conexión.

## Convenciones de almacenamiento

| Dato | Representación |
|---|---|
| IDs | `TEXT`, UUIDv7 o ULID generado por la aplicación |
| Dinero | entero en unidades menores + `currency_code` |
| Tasas | entero escalado o decimal textual, nunca `float` |
| Cantidades | entero escalado según unidad de medida |
| Tiempo | epoch milliseconds UTC |
| JSON | texto validado en la frontera |
| Borrado | evitar hard delete en datos auditables; usar estado o `deleted_at` |

## Tablas transversales

- `business_event`: hechos seleccionados append-only para historia y proyecciones.
- `outbox_event`: eventos pendientes, intentos, estado y error de publicación.
- `audit_log`: actor, acción, entidad, cambios, terminal y timestamp.
- `idempotency_key`: resultado asociado a una solicitud repetible.
- `schema_migrations`: administrada por la herramienta de migración.

## Transacciones

Los cambios de un caso de uso se ejecutan dentro de una transacción. El agregado, los hechos de ledger, la auditoría, la idempotencia y el outbox que correspondan se confirman juntos.

En la Fase 3, `SqliteUnitOfWork` ejecuta `BEGIN IMMEDIATE -> guardar -> COMMIT` y revierte ante cualquier error. Los repositorios Drizzle rechazan escrituras sin una transaccion activa. Una venta completada o anulada y un turno cerrado son inmutables; las versiones obsoletas se rechazan.

La lectura relacional rehidrata agregados sin regenerar eventos de dominio históricos. Los snapshots comerciales de una venta se almacenan junto a la venta y no dependen de la configuracion vigente del catalogo.

No se permite una transacción abierta durante una llamada de hardware o red. La impresión debe usar un estado persistido y un mecanismo de reconciliación.

## Migraciones y respaldo

- Migraciones forward-only versionadas en el repositorio.
- Las migraciones se prueban sobre una base temporal antes de arrancar producción.
- Backups automáticos con snapshot consistente y rotación.
- Restauración probada periódicamente, no solo creación de backups.
- `schema_migrations` conserva version, nombre, checksum y momento de aplicacion. Un checksum distinto detiene el arranque.
- Antes de migrar una base existente se valida un respaldo consistente; ante una falla de migracion o validacion se restaura ese archivo. No existen scripts `down` destructivos.

## Fase 0

No se crean tablas de negocio ni migraciones. El scaffold solo prepara el lugar para el esquema Drizzle de la Fase 1.
