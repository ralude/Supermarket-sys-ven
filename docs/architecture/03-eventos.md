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
| `inventory` | `StockAdjusted`, `StockDepleted`, `BatchExpiringSoon` |

En `cash`, `ShiftOpened` conserva el fondo inicial, `CashMovementRegistered`
explica cada ingreso o retiro manual y `ShiftClosed` congela saldo esperado,
conteo declarado y diferencia por moneda y método. La integración de pagos de
venta con el turno queda para la Fase 5.

En Fase 2, `inventory` conserva sus movimientos como historia inmutable dentro
de `StockItem`, pero no publica eventos de integración. `StockAdjusted`,
`StockDepleted` y `BatchExpiringSoon` se concretan con los flujos operativos,
persistencia y políticas de la Fase 6.

## Flujo de publicación

```text
Caso de uso
  -> agregado registra evento de dominio
  -> transacción persiste agregado relacional + ledger + outbox cuando corresponda
  -> relay publica evento de integración
  -> consumidor procesa con idempotencia
```

No se debe publicar un evento externo antes del commit. Si el proceso falla después del commit, el relay reintenta desde el outbox.

Las tablas relacionales son la fuente de verdad del estado actual. `business_event`, `outbox_event` y `audit_log` tienen finalidades distintas y no se sustituyen entre sí.

## Fase 0

En esta fase solo se define el contrato. No se implementa un bus, relay ni handler de negocio.
