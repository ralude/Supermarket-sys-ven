# FS-001: timeout fiscal con delivery `UNKNOWN`

## Respaldo actual

**Implementado y probado contra `FiscalPrinterFake` y SQLite.** El documento se
persiste antes de tocar hardware, el timeout conserva evidencia separada y la
reconciliación puede confirmar una emisión después de reabrir SQLite sin volver
a imprimir. El orquestador automático de arranque y la evidencia autoritativa
de un perfil real siguen pendientes en 8.04.

## Riesgo

El host vence su deadline sin saber si la impresora recibió, aplicó, comprometió
o entregó físicamente el documento. Repetir la emisión puede crear dos
documentos fiscales; descartarla puede ocultar uno ya comprometido.

## Estado inicial

- Existe una solicitud con `idempotencyKey` y contenido fiscal validado.
- `FiscalDocument` fue persistido como `PENDING` y luego `PRINTING` antes de la
  llamada al puerto fiscal.
- No hay otra operación fiscal activa según el repositorio.

## Trigger del fallo

`FiscalPrinterPort` devuelve `FISCAL_PRINTER_TIMEOUT` con
`printDelivery = UNKNOWN`. Según la etapa también pueden ser `UNKNOWN` el efecto
del comando o el compromiso fiscal. En el fake, un timeout en `CLOSE` conserva
el documento confirmado en el dispositivo y entrega desconocida.

## Comportamiento que NO debe ocurrir

- No reenviar automáticamente `OPEN`, líneas, pagos ni `CLOSE`.
- No inferir `NOT_APPLIED` porque otra referencia sea la última observada.
- No convertir `retryable = true` en permiso inmediato de retry.
- No marcar `FAILED` mientras efecto o compromiso continúen `UNKNOWN`.
- No mantener una transacción SQLite abierta mientras se espera al dispositivo.

## Comportamiento esperado

1. Persistir el intento y su evidencia en `ERROR` cuando no exista confirmación
   positiva de compromiso.
2. Devolver un código público estable y seguro; una redelivery con la misma
   clave devuelve `FISCAL_RECONCILIATION_REQUIRED` y no imprime otra vez.
3. Consultar el dispositivo mediante reconciliación. Solo evidencia positiva de
   referencia y número fiscal permite pasar a `ISSUED`.
4. Si la consulta es inconclusa, conservar `ERROR`, registrar
   `FISCAL_RECONCILIATION_INCONCLUSIVE` y mantener el bloqueo.
5. Si se confirma `APPLIED + COMMITTED` con entrega `UNKNOWN`, el documento es
   `ISSUED`; la recuperación de una copia permitida no es una segunda emisión.

## Garantía/invariante del sistema

Un timeout nunca autoriza por sí solo una segunda emisión. `ISSUED` requiere
evidencia positiva de compromiso fiscal y es inmutable. El estado y los cuatro
ejes de evidencia sobreviven a la reapertura de SQLite.

Esta garantía está probada con el fake. Ningún perfil físico está declarado
soportado todavía, por lo que no se afirma que una impresora real pueda aportar
la evidencia requerida.

## Retry semantics

- `retryable` expresa elegibilidad, no terminalidad ni ejecución automática.
- Un retry solo es seguro si no queda ninguna dimensión relevante `UNKNOWN` y
  la evidencia demuestra que el intento no empezó o que fue
  `NOT_APPLIED + NOT_COMMITTED` con entrega incompleta.
- Reconciliar o reconectar no reenvía el comando.
- La misma `idempotencyKey` con otro payload produce
  `IDEMPOTENCY_KEY_CONFLICT`.

## Estrategia de recuperación

- Reabrir SQLite y enumerar documentos `PENDING`, `PRINTING`, `ERROR` y
  `RETRYING` mediante `findRecoverable()`.
- Ejecutar `ReconcileFiscalState` con motivo y actor.
- Confirmar `ISSUED` solo con evidencia positiva; si la evidencia queda
  `UNKNOWN`, escalar a intervención y conservar el dispositivo bloqueado.
- Brecha vigente: el barrido está diseñado, pero aún no está compuesto en el
  startup; `ReconcileFiscalReport` para X/Z también está pendiente.

## Observabilidad

- Error técnico con `errorCode`, `correlationId`, terminal, nodo y operación.
- Transición durable con evidencia de dispatch, efecto, compromiso y entrega.
- Auditoría `FISCAL_DOCUMENT_ERROR_RECORDED`,
  `FISCAL_DOCUMENT_RECONCILED` o
  `FISCAL_DOCUMENT_RECONCILIATION_INCONCLUSIVE`, con actor y motivo.
- Ledger/outbox solo publican `FiscalDocumentIssued` después del commit que
  confirma `ISSUED`.

## Impacto al usuario/negocio

La operación queda pendiente de conciliación y puede bloquear nuevas
operaciones fiscales del dispositivo. El usuario no debe recibir una promesa de
“no emitido” ni poder pulsar una reimpresión ciega; necesita un estado de
recuperación o escalamiento visible cuando la UI se implemente.

## Componentes involucrados

- `FiscalDocument` y `FiscalOperationEvidence`.
- `IssueFiscalDocument` y `ReconcileFiscalState`.
- `FiscalPrinterPort` y adaptador fiscal.
- `FiscalDocumentRepository`, `SqliteUnitOfWork`, ledger, outbox y auditoría.
- Orquestador de arranque fiscal, todavía pendiente de composición.

## Pruebas asociadas

- [`fiscal-flow.integration.test.ts`](../../packages/drivers/db/src/fiscal-flow.integration.test.ts):
  `reconciles a timeout after restart without duplicate printing and persists X/Z`.
- [`issue-fiscal-document.test.ts`](../../packages/core/src/application/fiscal/issue-fiscal-document.test.ts):
  `persists an uncertain error and requires reconciliation on redelivery` y
  `keeps an uncertain document blocked when the last device reference is different`.
- [`fiscal-document.test.ts`](../../packages/core/src/domain/fiscal/fiscal-document.test.ts):
  `requires reconciliation before retrying an uncertain print` y casos que
  bloquean retry/terminalidad con evidencia desconocida.
- [`fiscal-document-repository.test.ts`](../../packages/drivers/db/src/fiscal-document-repository.test.ts):
  reapertura y recuperación de evidencia `UNKNOWN`.

## ADRs/documentos relacionados

- [Estados fiscales](../architecture/09-estados-fiscales.md)
- [Errores](../architecture/11-errores.md)
- [Base de datos](../architecture/08-base-de-datos.md)
- [ADR-0004](../architecture/adr/0004-estados-fiscales-persistidos.md)
- [ADR-0006](../architecture/adr/0006-errores-logs-auditoria.md)
- [ADR-0010](../architecture/adr/0010-transporte-serial-y-protocolos-fiscales.md)
- [8.04 Retry seguro y reconciliación](../cronograma/fase-08-integracion-serial/8.04-retry-reconciliacion.md)
- [Diseño del orquestador de arranque](../cronograma/fase-08-integracion-serial/orquestador-arranque-fiscal.md)

