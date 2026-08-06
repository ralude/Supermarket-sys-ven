# Fase 4: Event Store y auditoria

- **Estado:** Pendiente
- **Indice:** [Cronograma](../README.md)

## Proposito

Conservar los hechos de negocio y la auditoria append-only sin borrar el historial.

## Sub-fases

- [4.01 Event store](./4.01-event-store.md)
- [4.02 Outbox](./4.02-outbox.md)
- [4.03 Auditoria](./4.03-auditoria.md)
- [4.04 Idempotencia](./4.04-idempotencia.md)
- [4.05 Historial de venta](./4.05-historial-venta.md)

## Criterio de salida

Cada cambio de negocio produce eventos inmutables y auditables dentro de la misma transaccion.
