# Fase 10: Sincronizacion

- **Estado:** Pendiente
- **Indice:** [Cronograma](../README.md)

## Proposito

Permitir operacion offline-first con una cola persistente que sincroniza eventos, nunca tablas.

## Sub-fases

- [10.01 Sync queue](./10.01-sync-queue.md)
- [10.02 Protocolo de eventos](./10.02-protocolo-eventos.md)
- [10.03 Servidor receptor](./10.03-servidor-receptor.md)
- [10.04 Offline y reconexion](./10.04-offline-reconexion.md)

## Criterio de salida

Una operacion local sobrevive cortes de red y sus eventos se entregan de forma idempotente.
