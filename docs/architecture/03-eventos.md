# 03. Eventos

## Tipos

### Eventos de dominio

Representan hechos ocurridos dentro de un agregado. Son inmutables y se crean dentro del dominio. Se despachan después de persistir el agregado.

Ejemplos: `SaleCompleted`, `PaymentRegistered`, `PriceChanged`, `ShiftClosed`.

### Eventos de integración

Son contratos entre módulos, procesos o estaciones. Se serializan, versionan y persisten en `outbox_event` dentro de la misma transacción que el cambio de negocio.

Ejemplos: `FiscalDocumentRequested.v1`, `FiscalDocumentIssued.v1`, `ExchangeRateUpdated.v1`.

### Ledger de hechos de negocio

Conserva hechos seleccionados de forma append-only para explicar el historial y construir proyecciones. No es la fuente de verdad operativa y no necesita contener todo lo requerido para rehidratar un agregado.

## Convenciones

- Nombre en pasado, orientado a hechos.
- Payload mínimo: IDs, versión, timestamp y datos necesarios para el consumidor.
- `eventId` único e idempotente.
- `aggregateId`, `aggregateType` y `occurredAt` obligatorios.
- Versionado explícito (`v1`) para contratos publicados.
- Los handlers deben tolerar reentrega.
- No se usan eventos como sustituto de comandos: un evento nunca significa "haz esto".

## Catálogo inicial

| Módulo | Evento |
|---|---|
| `catalog` | `ProductCreated`, `PriceChanged` |
| `currency` | `ExchangeRateUpdated` |
| `cash` | `ShiftOpened`, `ShiftClosed`, `CashMovementRegistered` |
| `sales` | `SaleStarted`, `SaleItemAdded`, `SaleItemRemoved`, `DiscountApplied`, `PaymentRegistered`, `SaleCompleted`, `SaleVoided` |
| `fiscal` | `FiscalDocumentIssued`, `FiscalDocumentFailed`, `FiscalXReportIssued`, `FiscalZReportIssued` |
| `inventory` | `StockMovementRegistered` |

En `cash`, `ShiftOpened` conserva el fondo inicial, `CashMovementRegistered`
explica cada ingreso, retiro manual o pago derivado de una venta y `ShiftClosed`
congela saldo esperado, conteo declarado y diferencia por moneda y método.
Desde la Fase 6, `SaleCompleted.v1` incluye turno, terminal y snapshots primitivos
de sus pagos e items. Caja e inventario lo consumen de forma idempotente sin leer
tablas de ventas.

Desde la Fase 6, `StockMovementRegistered` explica en el ledger cada recepcion,
salida de venta, merma o ajuste persistido en `StockItem`. Todavia no es un evento
de integracion: la publicacion para consolidacion entre nodos se define en la Fase 10.

## Flujo de publicación

```text
Caso de uso
  -> agregado registra evento de dominio
  -> transacción persiste agregado relacional + ledger + outbox cuando corresponda
  -> relay publica evento de integración
  -> consumidor procesa con idempotencia
```

No se debe publicar un evento externo antes del commit. Si el proceso falla después del commit, el relay reintenta desde el outbox.

Desde la Fase 4, `BusinessEventV1` es el sobre persistido: separa el payload del dominio y conserva version contractual, agregado, version, nodo de origen, correlacion, actor y UTC. Los value objects se convierten explicitamente a primitivas JSON.

`business_event` es append-only y ordena por version del agregado. `SaleCompleted.v1` es el primer contrato seleccionado para `outbox_event`. El relay reclama con lease, confirma la transaccion y solo entonces publica; la confirmacion o el reintento se persisten en otra transaccion corta.

Las tablas relacionales son la fuente de verdad del estado actual. `business_event`, `outbox_event` y `audit_log` tienen finalidades distintas y no se sustituyen entre sí. `GetSaleHistory` proyecta una vista por version desde el ledger, pero nunca rehidrata `Sale` para operacion.

## Fase 0

En esta fase solo se define el contrato. No se implementa un bus, relay ni handler de negocio.
