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

Los logs técnicos usan una lista permitida de metadatos. No registran bodies
HTTP completos ni objetos de dominio serializados.

Nunca se registran PINs, contraseñas, tokens, cookies, headers de autorización,
claves, números de tarjeta ni credenciales de hardware. Tampoco se registran
RIF, cédula, pasaporte, nombre, dirección, teléfono o correo del cliente;
contenido de documentos fiscales; líneas o medios de pago; ni montos de venta o
pago. Para correlación se usan IDs técnicos de entidad, operación y documento.

Un requisito diagnóstico que necesite un dato excluido debe aprobar finalidad,
acceso, retención y representación mínima antes de cambiar la lista permitida.
Cuando baste, se usa un identificador pseudonimizado o valor agregado. Los
errores se redactan antes de registrarse o persistirse.

La auditoría conserva la evidencia de negocio exigida por su contrato, pero no
duplica PII del cliente si `entityId`, acción y motivo bastan. Registrar acceso
a PII no implica copiar el valor consultado dentro de la auditoría.

Desde 9.06, la lectura operativa de auditoría exige el permiso
`reports.audit.read` y proyecta actor, roles, acción, entidad, motivo, terminal,
nodo, UTC y correlación. No proyecta los resúmenes antes/después, que pueden
contener datos excluidos por esta lista permitida; ADR-0013 fija ese alcance, el
límite de filas y la exportación.

## Integridad

La auditoría debe ser append-only desde la aplicación. Una cadena hash opcional puede añadirse cuando exista un requisito de evidencia contra manipulación.

Desde la Fase 4, `audit_log` conserva actor, roles, accion, entidad, resumen antes/despues, motivo, terminal, nodo, UTC y correlacion. Los adaptadores redactan claves sensibles antes de serializar y triggers SQLite impiden mutar o borrar evidencia. La cadena hash sigue diferida hasta que exista un requisito formal.

## Fase 0

Se define la separación y el contrato de campos. El logging técnico se compone con el transporte antes de la UI operativa; `audit_log` se implementa en la Fase 4 después de disponer de persistencia.
