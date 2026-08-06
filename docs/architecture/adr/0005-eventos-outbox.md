# ADR-0005: Eventos y outbox

- Estado: Aceptado
- Fecha: 2026-08-05

## Contexto

Los eventos deben llegar a otros módulos o estaciones aun cuando el proceso se cierre después de guardar el cambio de negocio.

## Decisión

Los agregados producirán eventos de dominio. Los eventos de integración se guardarán en una tabla outbox dentro de la misma transacción que el cambio de negocio. Un relay posterior publicará y reintentará esos eventos.

## Consecuencias

- Se evita la inconsistencia entre base de datos y bus.
- Los consumidores deben ser idempotentes.
- El outbox necesita monitoreo, retención y limpieza controlada.
- En Fase 0 solo se documenta el contrato; no se implementa el relay.
