# 10. Logs

## Dos registros distintos

### Logs técnicos

Sirven para diagnosticar ejecución: errores, latencia, conexiones, reinicios, estado de adaptadores y fallos de infraestructura. Se implementarán con Pino en formato estructurado.

Campos mínimos:

- `timestamp`;
- `level`;
- `service`;
- `module`;
- `correlationId`;
- `terminalId`;
- `userId` cuando exista;
- `operation`;
- `errorCode` cuando aplique.

### Auditoría de negocio

Es evidencia de acciones sensibles y debe persistirse en SQLite. Incluye anulaciones, cambios de precio, retiros, cierres, overrides y cambios de configuración fiscal.

Campos mínimos:

- actor y rol;
- acción;
- entidad y `entityId`;
- estado antes/después o motivo;
- terminal;
- fecha UTC;
- correlation ID.

## Retención y destinos

- Consola en desarrollo.
- Archivos rotados en el directorio de datos de la aplicación.
- Retención configurable, con valor inicial sugerido de 30 días para logs técnicos.
- Auditoría sujeta a una política de retención independiente.

## Protección de datos

Nunca se registran PINs, contraseñas, tokens, claves, números completos de tarjeta ni credenciales de hardware. Los errores se redactan antes de persistirse.

## Integridad

La auditoría debe ser append-only desde la aplicación. Una cadena hash opcional puede añadirse cuando exista un requisito de evidencia contra manipulación.

## Fase 0

Se define la separación y el contrato de campos. La configuración Pino y la tabla `audit_log` se implementarán junto con infraestructura en la Fase 1.
