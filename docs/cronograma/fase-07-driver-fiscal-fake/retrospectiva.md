# Retrospectiva de la Fase 7: Driver fiscal fake

- **Fecha de revision:** 2026-08-30
- **Commit de cierre revisado:** `f670053`
- **Resultado:** base semantica valida con deudas transferidas al gate 8.00

## Evidencia de cierre

La revision se hizo contra codigo, migraciones, pruebas y cronograma, no solo
contra las tareas marcadas. La linea base ejecutada fue:

- `pnpm test`: 59 archivos y 198 pruebas aprobadas;
- `pnpm typecheck`: 8 paquetes aprobados;
- arbol de trabajo limpio antes de esta planificacion;
- ninguna dependencia `serialport` o `@serialport/*` instalada.

Las descripciones de deuda siguientes retratan el commit de cierre `f670053`;
las líneas de acción indican su estado posterior dentro de la Fase 8.

## Lo que funciono bien

- `FiscalPrinterPort` vive en aplicacion y `FiscalPrinterFake` permanece en el
  driver, sin contaminar dominio ni casos de uso con detalles del proveedor.
- Se respeto la restriccion de no abrir hardware real en Fase 7.
- El documento persiste `PENDING` y `PRINTING` antes de invocar el hardware; la
  llamada al printer ocurre fuera de la transaccion SQLite.
- La certeza `NOT_SENT | REJECTED | UNKNOWN` evita modelar todos los fallos como
  un timeout generico.
- La prueba integrada simula un timeout en `CLOSE`, reabre SQLite y confirma el
  documento sin repetir `OPEN`, `ITEM`, `PAYMENT` ni `CLOSE`.
- Documentos, lineas, pagos, transiciones, jornada, reportes, ledger, outbox y
  auditoria quedan persistidos mediante una migracion forward-only.
- Facturas, notas de credito, reportes X/Z y fallos principales tienen pruebas
  deterministas sin hardware.

## Lo que no debe asumirse al entrar en Fase 8

### El contract test es semantico, no serial

En el commit de cierre, el harness importaba `FiscalFakeCommand` y
`FiscalFakeResponse`, inyectaba
`queueResponses`, abría/cerraba el fake y esperaba el numero literal
`INV-000001`. Era util para el fake, pero no podía ejecutarse sin cambios contra
un adaptador real. Tampoco comprueba bytes, campos monetarios, encoding,
framing, secuencia, checksum ni status words de un fabricante.

Accion completada en 8.00: el contrato observable de `FiscalPrinterPort` ya no
importa controles del simulador; transcript, fallos y numeracion determinista
permanecen en las pruebas del fake y cada protocolo conserva vectores propios.

### El contenido del puerto no alcanza para un documento real

`FiscalDocumentContent` conserva referencia, tipo, moneda general, lineas,
pagos y total, pero no identidad fiscal del comprador, tasa/fuente por pago,
desglose IGTF ni los datos fiscales de la factura original que requiere una nota
de credito. El fake puede completar su transcript sin esos campos; un adaptador
real no debe inventarlos ni buscarlos por fuera del caso de uso.

Accion: 8.00 compara campo por campo dominio, DTO, persistencia, requisitos
vigentes y protocolo seleccionado, escribe pruebas outside-in y completa el
contrato semantico antes de implementar encoder o comandos.

### Falta reconciliacion completa de X/Z

En el commit de cierre, `PrintFiscalReport` podía dejar un reporte en `ERROR` y
luego exigir reconciliacion, pero no existían un `ReconcileFiscalReport` de
aplicacion ni una consulta de reportes recuperables. `FiscalDay.retryReport`
solo era alcanzable desde dominio. Un timeout de Z no puede resolverse
repitiendo el cierre.

Accion parcialmente completada en 8.00: la consulta de reportes recuperables ya
se implementó y probó al reabrir SQLite; siguen pendientes
`ReconcileFiscalReport` y su evidencia autoritativa antes de enviar un Z real.

### El startup recuperable todavia no esta compuesto

El repositorio puede enumerar documentos recuperables, pero ningun bootstrap
del nodo consume `findRecoverable()`. La prueba de reinicio llama manualmente a
`ReconcileFiscalState` despues de reabrir SQLite.

Accion: 8.00 define el orquestador de arranque y 8.04 lo valida con el adaptador
seleccionado. El nodo no acepta nuevas operaciones fiscales hasta terminar el
barrido o quedar bloqueado para intervencion.

### La ausencia como ultimo documento no es evidencia negativa

En el commit de cierre, la reconciliacion trataba una referencia distinta a la
ultima observada como `NOT_SENT` y habilitaba el retry. En una impresora real
esto no prueba que el documento nunca se emitio ni que no haya una transaccion
abierta.

Accion base completada en 8.00: la falta de coincidencia ya conserva `UNKNOWN`
y bloquea. Cada adaptador todavía debe aportar evidencia positiva de `ISSUED` o
`NOT_ISSUED`; `UNKNOWN` nunca se convierte por descarte en `NOT_ISSUED`.

### La certeza depende tambien de la etapa

El fake asocia cada tipo de fallo con una certeza fija. En hardware, un puerto
cerrado antes de escribir y una desconexion despues de aceptar `PAYMENT` no
tienen la misma certeza, aunque terminen en un error parecido del sistema
operativo.

Accion: 8.03 conserva etapa, epoch y limites de envio; 8.04 clasifica el
resultado usando la evidencia del transporte y del protocolo.

### Falta exclusion unica para todo el dispositivo

Los documentos y los reportes se coordinan en flujos separados. Una impresora
solo puede ejecutar una operacion fiscal a la vez y una incertidumbre en
factura, nota, X o Z debe bloquear a las demas.

Accion: 8.03 introduce single-flight por dispositivo sin crear una cola de
replay automatico.

## Decisiones para la fase siguiente

- No se reabre ni reescribe el historial de tareas completadas de Fase 7.
- Las deudas que condicionan hardware real se convierten en la sub-fase 8.00.
- El transporte serial se comparte; los protocolos y mapas de status son por
  proveedor/familia/modelo/firmware, segun ADR-0010.
- El primer adaptador real no se selecciona hasta tener hardware de laboratorio,
  manual de integracion vigente, modelo/firmware identificados y ruta de
  autorizacion por modelo y registro ante el fabricante confirmada.
- Las siguientes entregas se dividen por gate, transporte, codec, coordinacion,
  reconciliacion, estado y calificacion de hardware para evitar otro cambio
  monolitico.

## Resultado de la retrospectiva

La Fase 7 demuestra correctamente la orquestacion fiscal contra un fake y deja
una base persistente valiosa. No demuestra aun compatibilidad serial ni una
recuperacion segura para cualquier impresora fiscal. Por eso la Fase 8 comienza
con un gate contractual y regulatorio, no con la incorporacion inmediata de una
dependencia nativa al workspace de produccion.
