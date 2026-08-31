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
| Dominio | `SALE_INVALID_STATE`, `SHIFT_INVALID_STATE`, `CASH_WITHDRAWAL_INSUFFICIENT_FUNDS`, `USER_ROLE_NOT_ASSIGNABLE`, `STOCK_INSUFFICIENT`, `STOCK_QUANTITY_SCALE_MISMATCH`, `FISCAL_COMMIT_EVIDENCE_REQUIRED`, `FISCAL_FAILURE_EVIDENCE_INVALID`, `FISCAL_TERMINAL_FAILURE_EVIDENCE_REQUIRED` |
| Aplicación | `RESOURCE_NOT_FOUND`, `SHIFT_NOT_FOUND`, `CASH_REGISTER_NOT_FOUND`, `SALE_HISTORY_NOT_FOUND`, `IDEMPOTENCY_KEY_CONFLICT`, `FISCAL_RECONCILIATION_INCONCLUSIVE`, `UNAUTHORIZED`, `FORBIDDEN`, `CONFLICT` |
| Infraestructura | `DATABASE_BUSY`, `DATABASE_CONSTRAINT_VIOLATION`, `DATABASE_TRANSACTION_REQUIRED`, `DATABASE_CONCURRENCY_CONFLICT`, `DATABASE_MIGRATION_FAILED`, `DATABASE_MIGRATION_MISMATCH`, `DATABASE_FISCAL_EVIDENCE_INVALID`, `DATABASE_FISCAL_TRANSITION_SEQUENCE_INVALID`, `FISCAL_REPORT_IDENTITY_CONFLICT`, `FISCAL_PRINTER_NAK`, `FISCAL_PRINTER_PAPER_END`, `FISCAL_PRINTER_MEMORY_FULL`, `FISCAL_PRINTER_BUSY`, `FISCAL_PRINTER_TIMEOUT`, `FISCAL_PRINTER_CRC_ERROR`, `FISCAL_PRINTER_PORT_CLOSED`, `NETWORK_UNAVAILABLE` |

## Fronteras

HTTP debe responder `application/problem+json` sin stack traces. IPC debe devolver un envelope serializable. WebSocket no debe filtrar detalles internos.

La UI traduce `code` a un mensaje en español. El código es el contrato; el texto no debe ser usado para lógica.

## Política de reintentos

- Reintentar solo errores transitorios y con límite.
- No reintentar una operación fiscal si puede duplicar un documento sin reconciliación.
- Un `UNKNOWN` en efecto, compromiso o entrega bloquea retry y exige
  reconciliacion; `REJECTED` tampoco implica `NOT_APPLIED` salvo confirmación
  autoritativa del perfil.
- En el adaptador real, dispatch, efecto del comando, compromiso fiscal y
  entrega impresa se conservan separados. `dispatchState = NOT_STARTED` solo
  describe un intento que el adaptador no inició; en serial exige no haber
  invocado `write()`. Una consulta posterior puede confirmar `NOT_APPLIED`,
  pero no cambiar la historia del dispatch ni convertir su respuesta en la del
  comando original.
- `SQLITE_BUSY` puede reintentarse con backoff corto.
- La pérdida de red se maneja en el cliente con reconexión e idempotencia.

## Observabilidad

Cada error debe incluir `correlationId` en logs. El stack trace queda solo en el log técnico protegido, nunca en la respuesta al usuario.

## Fase 0

`AppError` y `Result` se implementan como primitivas compartidas. El catálogo completo de códigos y los mapeadores HTTP/IPC se implementarán junto con los casos de uso.
