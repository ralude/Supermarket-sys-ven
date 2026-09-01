# FS-003: impresora desconectada durante un documento

## Respaldo actual

**Decidido, pendiente de integración física.** El fake distingue puerto cerrado
antes de iniciar de un fallo después de avanzar el transcript, y el dominio
aplica la política fail-closed. No existe todavía `SerialPort` de producción,
prueba USB por etapa ni exclusión única compuesta para documentos y reportes.

## Riesgo

La impresora puede desconectarse antes de enviar bytes o después de aceptar una
parte del documento. Ambos casos producen síntomas parecidos en el host, pero
solo el primero permite afirmar que ese intento no empezó. Reabrir el puerto y
repetir puede duplicar o corromper la sesión fiscal.

## Estado inicial

- `FiscalDocument` fue persistido en `PRINTING` antes de I/O.
- El contenido quedó sellado y no hay una transacción SQLite abierta.
- El servicio fiscal local es el owner lógico previsto del dispositivo.

## Trigger del fallo

El puerto está cerrado antes del primer comando o la conexión se pierde después
de `OPEN`, una línea, un pago o durante `CLOSE`.

## Comportamiento que NO debe ocurrir

- No clasificar toda desconexión como `NOT_STARTED`.
- No crear un segundo owner o abrir otro puerto mientras el runtime anterior
  pueda conservar I/O o lock incierto.
- No reproducir comandos o tramas persistidas al reconectar o reiniciar.
- No aceptar facturas, notas, X o Z nuevas mientras haya una intención ambigua.
- No exponer puerto, handle, bytes ni APIs nativas al renderer.

## Comportamiento esperado

- Antes de iniciar: representar `NOT_STARTED + NOT_APPLIED + NOT_COMMITTED +
  INCOMPLETE`; el intento puede ser elegible para retry explícito.
- Después de iniciar: conservar `STARTED` o `RESULT_RECEIVED` según la evidencia,
  y mantener como `UNKNOWN` todo efecto o entrega que el perfil no pueda probar.
- Persistir `ERROR` y exigir reconciliación; reconectar el transporte no reenvía
  la operación.
- Si el equipo confirma compromiso, marcar `ISSUED` aunque la entrega sea
  `INCOMPLETE` o `UNKNOWN`. Si no puede concluir, mantener bloqueo e intervención.

## Garantía/invariante del sistema

Una desconexión posterior al inicio nunca se degrada a “no enviado” sin
evidencia autoritativa. La intención durable sobrevive al reinicio y una nueva
operación no debe reemplazar silenciosamente la pendiente.

La persistencia y regla de dominio están implementadas. La exclusión física
single-flight y el bloqueo de startup completo están diseñados, no compuestos.

## Retry semantics

- Retry fiscal posible solo con evidencia completa y segura.
- Reconnect usa backoff acotado con jitter cuando se implemente, pero no hace
  replay.
- Un deadline del runtime nativo deja de esperar; no demuestra cancelación ni
  libera el ownership.
- El intento siguiente limpia error/evidencia anterior antes de nuevo I/O para
  no atribuirle certeza obsoleta.

## Estrategia de recuperación

- Cerrar o terminar de forma controlada el runtime propietario y verificar que
  liberó el recurso antes de crear otro owner.
- Reabrir SQLite, enumerar toda intención fiscal recuperable y entrar en
  `RECOVERY_REQUIRED`.
- Si una versión anterior dejó la intención como `FAILED` o `RETRYING` con
  evidencia insegura, 0012 la reabre en `ERROR` con una transición correctiva;
  la migración no reconecta ni reenvía.
- Consultar identidad, sesión abierta, referencia, contadores y número fiscal
  que permita el perfil.
- Resolver por evidencia positiva o escalar a servicio/intervención autorizada;
  nunca mediante repetición automática.

## Observabilidad

- Código `FISCAL_PRINTER_PORT_CLOSED` o error de transporte mapeado, con
  `correlationId`, terminal, nodo, etapa y epoch del owner.
- Estado de transporte `DISCONNECTED` o `QUARANTINED`, no un falso `READY`.
- Transición durable del documento y auditoría de reconciliación/intervención.
- Métricas de desconexión, recuperación y bloqueo quedan pendientes en 8.05.

## Impacto al usuario/negocio

El dispositivo puede quedar temporalmente fuera de servicio y bloquear nuevas
emisiones. El operador necesita instrucciones para revisar conexión/papel y
escalar sin ofrecer un botón de reimpresión ciega. Un documento comprometido
con papel incompleto sigue siendo fiscalmente emitido.

## Componentes involucrados

- Servicio fiscal local y futuro owner del runtime nativo.
- Transporte SerialPort o gateway específico, según perfil.
- Adaptador fiscal, `FiscalPrinterPort` y estado del dispositivo.
- `FiscalDocument`, casos de uso fiscales y repositorio SQLite.
- Orquestador de arranque y exclusión single-flight pendientes.

## Pruebas asociadas

- [`fiscal-printer-fake.test.ts`](../../packages/drivers/fiscal/src/fiscal-printer-fake.test.ts):
  fixture `PORT_CLOSED`, cierre/apertura del fake y corte del transcript tras el fallo inyectado.
- [`fiscal-document.test.ts`](../../packages/core/src/domain/fiscal/fiscal-document.test.ts):
  retry seguro cuando dispatch no empezó y bloqueo con evidencia desconocida.
- [`issue-fiscal-document.test.ts`](../../packages/core/src/application/fiscal/issue-fiscal-document.test.ts):
  no confundir una consulta posterior con la respuesta del comando original.
- [`migrations.test.ts`](../../packages/drivers/db/src/migrations.test.ts):
  reapertura durable y recuperable de estados legacy ambiguos.
- Brecha explícita: faltan pruebas por etapa de desconexión USB, hard recovery,
  epoch y single-flight en 8.01, 8.03, 8.04 y 8.06.

## ADRs/documentos relacionados

- [Estados fiscales](../architecture/09-estados-fiscales.md)
- [IPC y ownership nativo](../architecture/07-ipc.md)
- [ADR-0002](../architecture/adr/0002-transporte-negocio-ipc.md)
- [ADR-0004](../architecture/adr/0004-estados-fiscales-persistidos.md)
- [ADR-0010](../architecture/adr/0010-transporte-serial-y-protocolos-fiscales.md)
- [8.01 Adaptador SerialPort](../cronograma/fase-08-integracion-serial/8.01-serialport-adapter.md)
- [8.03 Cola y exclusión](../cronograma/fase-08-integracion-serial/8.03-command-queue.md)
- [Diseño del orquestador](../cronograma/fase-08-integracion-serial/orquestador-arranque-fiscal.md)
