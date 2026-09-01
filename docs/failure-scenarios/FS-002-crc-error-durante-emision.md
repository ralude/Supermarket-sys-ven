# FS-002: CRC error durante emisión

## Respaldo actual

**Implementado con cobertura parcial.** El fake produce
`FISCAL_PRINTER_CRC_ERROR`, dominio bloquea retry con evidencia ambigua y
aplicación conserva `RESULT_RECEIVED` cuando una reconciliación confirma el
documento. Faltan vectores del protocolo real y pruebas end-to-end en cada etapa
de `OPEN`, `ITEM`, `PAYMENT` y `CLOSE`.

## Riesgo

Una respuesta con checksum inválido prueba que se recibió algo, no qué comando
procesó el equipo ni si cerró fiscalmente el documento. Confundir integridad de
transporte con ausencia de efecto puede duplicar una factura o perder el rastro
de una emisión válida.

## Estado inicial

- El documento durable está en `PRINTING`.
- El adaptador ejecuta una etapa del protocolo para un documento ya sellado.
- El perfil conoce el framing y algoritmo de CRC; en el repositorio actual esto
  solo está simulado, no existe todavía un codec de proveedor calificado.

## Trigger del fallo

El adaptador recibe una respuesta cuya validación CRC falla y retorna
`FISCAL_PRINTER_CRC_ERROR`. La evidencia mínima conserva que hubo respuesta
observable (`RESULT_RECEIVED` cuando aplica), pero no inventa su efecto fiscal.

## Comportamiento que NO debe ocurrir

- No tratar el frame corrupto como ACK, NAK ni `NOT_APPLIED`.
- No reintentar el comando fiscal solo porque `retryable` sea verdadero.
- No alterar el parser para aceptar un CRC inválido.
- No derivar compromiso fiscal desde `write()` o `drain()` exitosos.
- No asumir que el comportamiento del fake define bytes o estados universales.

## Comportamiento esperado

- Registrar el error estable y evidencia coherente sin perder la etapa conocida.
- Mantener el documento recuperable y bloquear retry mientras efecto, compromiso
  o entrega sean `UNKNOWN`.
- Consultar evidencia autoritativa del equipo. Si confirma la misma referencia
  y número, marcar `ISSUED` conservando `dispatchState = RESULT_RECEIVED` y
  `printDelivery = UNKNOWN`.
- Si no hay conclusión positiva, mantener `ERROR` y escalar; una referencia
  diferente no prueba que el documento no fue emitido.

## Garantía/invariante del sistema

Un CRC inválido nunca se promueve a respuesta fiscal válida. La historia de
dispatch no se reescribe durante la reconciliación y ninguna dimensión
`UNKNOWN` habilita retry.

La garantía es semántica y está probada con el fake; no acredita un algoritmo de
CRC, framing ni firmware real.

## Retry semantics

- El retry del documento queda prohibido mientras la evidencia sea ambigua.
- Solo un perfil calificado puede concluir `NOT_APPLIED + NOT_COMMITTED` y
  habilitar una nueva tentativa.
- Releer estado o pedir otra respuesta idempotente no equivale a reenviar el
  comando que falló.
- El backoff de reconexión del transporte, pendiente de 8.04, nunca incluye
  replay fiscal.

## Estrategia de recuperación

1. Persistir el error y los cuatro ejes de evidencia.
2. Consultar estado, referencia, número y demás evidencia disponible en el
   perfil sin emitir comandos mutantes.
3. Confirmar `ISSUED` si existe prueba positiva de compromiso; de lo contrario,
   conservar el bloqueo e intervención.
4. Validar el caso por etapa con vectores dorados y HIL antes de declarar un
   perfil soportado.
5. En un upgrade legacy, reabrir como `ERROR` cualquier `FAILED` o `RETRYING`
   ambiguo mediante la corrección versionada de 0012, sin emitir I/O.

## Observabilidad

- `FISCAL_PRINTER_CRC_ERROR`, `correlationId`, terminal, nodo, operación y etapa
  interna del adaptador.
- Evidencia neutral persistida; los bytes pueden quedar en diagnóstico protegido
  solo si la política del perfil lo permite y están redactados.
- Auditoría de error y reconciliación con actor y motivo.
- Métricas/alertas por checksum inválido están pendientes en 8.05.

## Impacto al usuario/negocio

La emisión queda en recuperación y puede bloquear el dispositivo. Si el equipo
confirma compromiso con entrega desconocida, el documento es emitido aunque el
papel no sea confiable; el flujo posterior debe obtener una copia permitida, no
crear otra factura.

## Componentes involucrados

- Futuro codec/parser específico del proveedor y transporte nativo.
- Adaptador de familia que traduce evidencia a `FiscalPrinterPort`.
- `FiscalDocument`, `IssueFiscalDocument`, `ReconcileFiscalState`.
- Persistencia fiscal, auditoría, ledger y outbox.

## Pruebas asociadas

- [`fiscal-printer-fake.test.ts`](../../packages/drivers/fiscal/src/fiscal-printer-fake.test.ts):
  fixture `CRC_ERROR` y `reports a committed document with unknown print delivery when CLOSE ends in CRC_ERROR`.
- [`issue-fiscal-document.test.ts`](../../packages/core/src/application/fiscal/issue-fiscal-document.test.ts):
  `preserves RESULT_RECEIVED when the original command already had response evidence`.
- [`fiscal-document.test.ts`](../../packages/core/src/domain/fiscal/fiscal-document.test.ts):
  bloqueo de retry con dimensiones `UNKNOWN`.
- [`migrations.test.ts`](../../packages/drivers/db/src/migrations.test.ts):
  recuperación de terminalidad legacy ambigua sin perder la evidencia.
- Brecha explícita: aún no hay pruebas de parser, vectores de bytes ni HIL de un
  perfil real; pertenecen a 8.02, 8.04 y 8.06.

## ADRs/documentos relacionados

- [Estados fiscales](../architecture/09-estados-fiscales.md)
- [Errores](../architecture/11-errores.md)
- [ADR-0004](../architecture/adr/0004-estados-fiscales-persistidos.md)
- [ADR-0010](../architecture/adr/0010-transporte-serial-y-protocolos-fiscales.md)
- [8.02 Parser de protocolo](../cronograma/fase-08-integracion-serial/8.02-parser-protocolo.md)
- [8.04 Retry seguro y reconciliación](../cronograma/fase-08-integracion-serial/8.04-retry-reconciliacion.md)
