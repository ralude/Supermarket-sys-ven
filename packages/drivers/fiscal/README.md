# @supermarket/driver-fiscal

Adaptadores para `FiscalPrinterPort` definidos por `@supermarket/core`.

Implementaciones:

- `FiscalPrinterFake` para tests y desarrollo, con respuestas deterministas configurables y transcripcion de comandos.
- adaptadores por fabricante/familia con modelo autorizado y compatibilidad
  tecnica confirmada.
- adaptador de impresora térmica libre cuando corresponda.

Un driver fiscal no puede modificar entidades, agregados ni casos de uso.

El subpath `@supermarket/driver-fiscal/testing` expone suites semanticas y
observables de `FiscalPrinterPort` exclusivamente para simuladores. No son una
suite HIL ni autorizan operaciones sobre una maquina fiscal real:

- `runFiscalPrinterSimulatorContract` valida estado publico, factura, nota de
  credito y fallos simulados. Exige `executionTarget: 'SIMULATOR'` y una lista
  no vacia de `failureScenarios`; también exige escenarios comprometidos con
  entrega `INCOMPLETE` o `UNKNOWN` para no confundir impresión física con
  compromiso fiscal.
- cada escenario solo configura, mediante `arrange(printer)`, la misma
  instancia creada por el harness y declara la operacion que debe fallar. La
  suite invoca esa operacion sobre `printer`; no acepta un callback que pueda
  fabricar el resultado o ejecutar otro fake.
- `runFiscalPrinterSimulatorReportContract` mantiene X/Z en una suite separada
  y exige, ademas del target de simulador,
  `simulatedReportExecution: 'ALLOW_SIMULATED_X_AND_Z'`. Sus escenarios de
  fallo son obligatorios y timeout/CRC no pueden inventar un compromiso
  `NOT_COMMITTED`; también cubre reportes comprometidos con entrega incompleta
  o desconocida.

Los guards se evaluan antes de configurar el escenario o llamar un metodo del
puerto. `createHarness` debe limitarse a construir el simulador sin ejecutar
operaciones. Una futura suite HIL sera independiente; un Reporte Z real exige
autorizacion operativa, presupuesto de pruebas y runbook del perfil exacto. El
consentimiento de simulacion nunca satisface esos requisitos.

El harness no conoce comandos, respuestas, transcript ni numeracion del fake.
Cada protocolo real mantiene por separado sus vectores exactos de bytes.

El subpath `@supermarket/driver-fiscal/testing/fixtures` conserva documentos
fiscales semanticos compartidos. El transcript `OPEN`, `ITEM`, `PAYMENT`,
`CLOSE`, la inyeccion de respuestas y la numeracion determinista se prueban
exclusivamente como comportamiento de `FiscalPrinterFake`, no como protocolo
universal.

La Fase 7 no incluye `SerialPort` ni acceso a hardware real.
