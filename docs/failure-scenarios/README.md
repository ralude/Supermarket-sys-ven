# Failure scenarios end-to-end

## Propósito

Este directorio describe cómo atraviesa el sistema completo un fallo crítico:
desde el trigger técnico hasta el estado durable, la recuperación y el impacto
operativo. No redefine códigos de error, máquinas de estado ni decisiones
arquitectónicas. Esas fuentes siguen siendo
[`11-errores.md`](../architecture/11-errores.md), los ADR y las especificaciones
de cada dominio.

Los escenarios solo afirman garantías respaldadas por una decisión aceptada,
código existente o pruebas. Una expectativa aún no implementada se marca como
brecha y no debe interpretarse como comportamiento vigente.

## Cómo leer el respaldo

- **Implementado y probado:** existe comportamiento observable y cobertura
  directa en el repositorio.
- **Implementado con cobertura parcial:** existe una base ejecutable, pero falta
  una prueba directa de alguna frontera end-to-end.
- **Decidido, pendiente de integración:** la política está aprobada, pero una
  fase abierta todavía debe componerla o validarla con infraestructura real.

## Escenarios iniciales

1. [FS-001: timeout fiscal con delivery `UNKNOWN`](./FS-001-timeout-fiscal-delivery-unknown.md)
   — implementado y probado contra el fake y SQLite; reconciliación de hardware
   real y barrido automático de arranque pendientes en Fase 8.
2. [FS-002: CRC error durante emisión](./FS-002-crc-error-durante-emision.md)
   — implementado y probado en dominio, aplicación y fake para evidencia
   ambigua; falta validación end-to-end por perfil real y por etapa.
3. [FS-003: impresora desconectada durante un documento](./FS-003-impresora-desconectada-durante-documento.md)
   — contrato y comportamiento fail-closed definidos; fake disponible, pero
   desconexión física por etapa y coordinación única siguen pendientes.
4. [FS-004: SQLite busy o conflicto de concurrencia](./FS-004-sqlite-busy-concurrency-conflict.md)
   — transacción, rollback, códigos estables y versiones implementados; el
   backoff del llamador no está implementado como política común.
5. [FS-005: venta concurrente de la última unidad](./FS-005-venta-concurrente-ultima-unidad.md)
   — stock no negativo e inventario append-only implementados en el nodo
   autoritativo; la concurrencia multi-terminal offline no ofrece garantía
   global y su política definitiva pertenece a Fase 10.

## Regla de mantenimiento

Actualiza una ficha cuando cambie cualquiera de estas superficies: estado
durable, clasificación de evidencia, código estable, retry, idempotencia,
ownership, reconciliación, bloqueo operativo, auditoría o prueba que sustenta la
garantía. Si el cambio crea una decisión nueva, primero actualiza la
especificación o ADR correspondiente y enlázalo desde el escenario.

Cada ficha conserva las secciones obligatorias: riesgo, estado inicial, trigger,
comportamiento prohibido, comportamiento esperado, garantía, retry,
recuperación, observabilidad, impacto, componentes, pruebas y documentos
relacionados.

