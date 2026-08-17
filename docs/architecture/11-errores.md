# 11. Errores

## Jerarquía

```text
AppError
├── DomainError
├── ApplicationError
└── InfrastructureError
```

Todos los errores públicos tienen código estable, mensaje seguro y detalles opcionales validados.

## Categorías

| Categoría | Ejemplos |
|---|---|
| Dominio | `SALE_INVALID_STATE`, `SHIFT_INVALID_STATE`, `CASH_WITHDRAWAL_INSUFFICIENT_FUNDS`, `STOCK_INSUFFICIENT` |
| Aplicación | `RESOURCE_NOT_FOUND`, `SHIFT_NOT_FOUND`, `CASH_REGISTER_NOT_FOUND`, `UNAUTHORIZED`, `FORBIDDEN`, `CONFLICT` |
| Infraestructura | `DATABASE_BUSY`, `FISCAL_PRINTER_OFFLINE`, `FISCAL_PRINTER_UNKNOWN_STATE`, `NETWORK_UNAVAILABLE` |

## Fronteras

HTTP debe responder `application/problem+json` sin stack traces. IPC debe devolver un envelope serializable. WebSocket no debe filtrar detalles internos.

La UI traduce `code` a un mensaje en español. El código es el contrato; el texto no debe ser usado para lógica.

## Política de reintentos

- Reintentar solo errores transitorios y con límite.
- No reintentar una operación fiscal si puede duplicar un documento sin reconciliación.
- `SQLITE_BUSY` puede reintentarse con backoff corto.
- La pérdida de red se maneja en el cliente con reconexión e idempotencia.

## Observabilidad

Cada error debe incluir `correlationId` en logs. El stack trace queda solo en el log técnico protegido, nunca en la respuesta al usuario.

## Fase 0

`AppError` y `Result` se implementan como primitivas compartidas. El catálogo completo de códigos y los mapeadores HTTP/IPC se implementarán junto con los casos de uso.
