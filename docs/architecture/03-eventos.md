# 03. Eventos

## Tipos

### Eventos de dominio

Representan hechos ocurridos dentro de un agregado. Son inmutables y se crean dentro del dominio. Se despachan después de persistir el agregado.

Ejemplos: `SaleCompleted`, `PaymentRegistered`, `PriceChanged`, `ShiftClosed`.

### Eventos de integración

Son contratos entre módulos, procesos o estaciones. Se serializan, versionan y persisten en `outbox_event` dentro de la misma transacción que el cambio de negocio.

Ejemplos: `FiscalDocumentRequested.v1`, `FiscalDocumentIssued.v1`, `ExchangeRateUpdated.v1`.

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
| `sales` | `SaleStarted`, `SaleItemAdded`, `PaymentRegistered`, `SaleCompleted`, `SaleVoided` |
| `fiscal` | `FiscalDocumentIssued`, `FiscalDocumentFailed`, `FiscalXReportIssued`, `FiscalZReportIssued` |
| `inventory` | `StockAdjusted`, `StockDepleted`, `BatchExpiringSoon` |

## Flujo de publicación

```text
Caso de uso
  -> agregado registra evento de dominio
  -> transacción persiste agregado + outbox
  -> relay publica evento de integración
  -> consumidor procesa con idempotencia
```

No se debe publicar un evento externo antes del commit. Si el proceso falla después del commit, el relay reintenta desde el outbox.

## Fase 0

En esta fase solo se define el contrato. No se implementa un bus, relay ni handler de negocio.
