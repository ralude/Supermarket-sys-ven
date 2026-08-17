# ADR-0009: Estado relacional, ledger y outbox

- Estado: Aceptado
- Fecha: 2026-08-14

## Contexto

La Fase 3 plantea guardar agregados en tablas relacionales y la Fase 4 hablaba de un event store capaz de reconstruir estados. Eso dejaba dos posibles fuentes de verdad y podía conducir accidentalmente a event sourcing completo.

## Decisión

Las tablas relacionales de agregados son la fuente de verdad del estado operativo. El sistema no usará event sourcing completo para el MVP.

En la misma transacción de negocio se persisten, según corresponda:

- el estado relacional del agregado;
- hechos de negocio seleccionados en un ledger append-only para historia;
- eventos de integración en `outbox_event` para entrega confiable;
- evidencia sensible en `audit_log`;
- el resultado de comandos reintentables en `idempotency_key`.

El ledger permite explicar una operación y construir proyecciones históricas, pero no se usa para recuperar el estado operativo al arrancar. El outbox es una cola de entrega y no sustituye el historial ni la auditoría.

## Consecuencias

- Repositorios y migraciones relacionales permanecen simples y explícitos.
- No se exige que cada evento contenga información suficiente para rehidratar agregados.
- El historial puede proyectarse de nuevo sin convertirse en la fuente de verdad transaccional.
- Ledger, outbox y auditoría tienen retención, propósito y permisos distintos.
- ADR-0005 se mantiene y queda complementado por esta separación.
