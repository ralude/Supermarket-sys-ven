# ADR-0006: Errores, logs y auditoría

- Estado: Aceptado
- Fecha: 2026-08-05

## Contexto

Los fallos técnicos requieren diagnóstico, mientras que anulaciones, cierres y cambios de precio requieren trazabilidad de negocio. Mezclar ambos registros produce datos incompletos o inseguros.

## Decisión

Usaremos errores tipados con códigos estables, logs técnicos estructurados con Pino y una auditoría de negocio persistida y append-only. Las fronteras HTTP e IPC ocultarán detalles internos y conservarán el código de error.

## Consecuencias

- La UI puede traducir errores por código.
- Los logs pueden rotarse sin borrar la auditoría.
- Debe existir redacción de secretos y datos sensibles.
- Los handlers globales deben capturar errores no esperados y asociarlos a un correlation ID.
