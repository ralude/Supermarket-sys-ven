# Fase 4: Ledger de eventos, outbox y auditoria

- **Estado:** Completada
- **Indice:** [Cronograma](../README.md)

## Proposito

Conservar hechos de negocio y auditoria append-only, y entregar eventos de integracion sin convertir el sistema en event sourcing.

## Sub-fases

- [~~4.01 Ledger de eventos~~](./4.01-event-store.md)
- [~~4.02 Outbox~~](./4.02-outbox.md)
- [~~4.03 Auditoria~~](./4.03-auditoria.md)
- [~~4.04 Idempotencia~~](./4.04-idempotencia.md)
- [~~4.05 Historial de venta~~](./4.05-historial-venta.md)

## Criterio de salida

Los cambios seleccionados persisten estado relacional, ledger, outbox, auditoria e idempotencia de forma atomica segun corresponda. El estado relacional sigue siendo la fuente de verdad.
