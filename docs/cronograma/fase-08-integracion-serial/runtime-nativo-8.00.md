# Decisión de runtime nativo para la integración fiscal

- **Fecha:** 2026-08-31
- **Estado:** Decidida; spike físico pendiente
- **Relacionada con:** [ADR-0010](../../architecture/adr/0010-transporte-serial-y-protocolos-fiscales.md)

## Decisión

El servicio fiscal local compuesto por `apps/server` conserva el único
**ownership lógico** del dispositivo. El binding SerialPort o un gateway nativo
que pueda bloquearse se ejecuta en un **proceso hijo supervisado**, dedicado a
un solo dispositivo lógico y creado por ese servicio.

No se ejecuta en renderer, preload ni una ruta Fastify. Tampoco se carga dentro
del proceso que mantiene SQLite abierto: terminar el runtime nativo para una
recuperación dura no debe derribar una transacción ni dejar dos procesos con la
base abierta.

```text
Electron main (supervisa el servidor local cuando corresponda)
  -> servicio fiscal en apps/server (owner lógico y readiness)
    -> proceso hijo fiscal nativo (owner físico exclusivo)
      -> SerialPort o gateway autorizado
```

La comunicación padre–hijo transporta mensajes internos tipados y redactados.
No expone handles, bytes, rutas COM, funciones de DLL ni errores técnicos al
renderer. El adaptador fiscal sigue traduciendo el resultado al contrato
semántico `FiscalPrinterPort`.

## Motivo

Un `open()` o I/O nativo puede continuar después de vencer el deadline del
llamador. Un proceso hijo ofrece una frontera terminable y reiniciable sin crear
un segundo owner ni detener el proceso SQLite. Un worker thread no es la
frontera elegida porque su terminación no se acepta como prueba de que una
llamada nativa bloqueada liberó el recurso del sistema operativo.

## Lifecycle obligatorio

1. El servidor adquiere la configuración y crea un único proceso hijo por
   dispositivo lógico.
2. El hijo abre el recurso configurado y devuelve identidad/capacidades sin
   ejecutar comandos fiscales mutantes.
3. Todas las operaciones pasan por una puerta single-flight compartida.
4. Un deadline deja de esperar y mueve el dispositivo a `QUARANTINED`; nunca
   confirma cancelación ni habilita replay.
5. El supervisor deja de aceptar trabajo, solicita cierre cooperativo y espera
   un plazo acotado.
6. Si el hijo no termina, el supervisor finaliza ese PID explícito y espera su
   salida. No crea un reemplazo mientras el proceso anterior siga vivo.
7. Antes de reiniciar, el supervisor prueba que el recurso puede adquirirse de
   forma exclusiva. Si no puede, conserva `QUARANTINED` y exige intervención.
8. Tras reiniciar, el servidor ejecuta el barrido durable y la identificación;
   nunca restaura una cola de comandos ni alcanza `READY` por el solo hecho de
   abrir el puerto.

## Versiones candidatas

- **Electron de producción:** `44.1.0`, rama estable soportada al corte. Se fija
  exactamente y se revalida antes del piloto porque Electron soporta solo sus
  tres ramas estables más recientes.
- **Node embebido de Electron 44.1.0:** `24.19.0` según el registro oficial de
  releases del corte.
- **SerialPort para el spike:** `13.0.0`, última release publicada por el
  proyecto al corte y con Node 20+ como requisito. No entra en manifests de
  producción hasta superar el spike y confirmar que el primer perfil usa una
  vía serial autorizada.
- **Sistema objetivo y observado:** Windows 11 Pro 25H2 x64, build
  `26200.9168`, edición `Professional`. Microsoft identifica build 26200 como
  Windows 11 25H2 y mantiene Home/Pro hasta el 2027-10-12. El valor legacy
  `ProductName` del registro no se usa para degradarlo a Windows 10. Edición,
  parche y soporte se revalidan en cada artefacto y equipo de laboratorio.

## Pruebas requeridas para cerrar el spike

- `list/open/close` con el binding nativo real en Node y en Electron empaquetado;
- apertura exclusiva y rechazo verificable desde un segundo proceso;
- `write -> backpressure -> drain -> response` con un dispositivo o loopback
  controlado, sin atribuir efecto fiscal a `drain`;
- desconexión antes y después de invocar `write()`;
- `open()` o I/O que no completa, terminación del hijo y comprobación de que el
  lock fue liberado antes de crear otro owner;
- inclusión del binding fuera de ASAR cuando el empaquetador lo requiera;
- repetición desde un build limpio Windows x64.

MockBinding puede probar lifecycle de JavaScript, pero no cierra packaging,
drivers, locks ni hard recovery del binding nativo.

## Evidencia pendiente

Este documento decide la arquitectura y las versiones candidatas. No afirma que
SerialPort 13.0.0 funcione con PF-SUNMI, que exista un driver compatible, que un
COM observado sea fiscal ni que HKA/ACLAS autorice una vía serial. Esas
conclusiones requieren el canal formal y el laboratorio definidos por 8.00.

## Verificación del corte

Ejecutada el 2026-08-31 en Windows x64:

- `pnpm --filter @supermarket/desktop exec electron --version`: `v44.1.0`;
- typecheck del desktop: aprobado;
- 2 pruebas del desktop: aprobadas;
- build Electron/Vite de main, preload y renderer: aprobado;
- `pnpm pipeline`: lint y typecheck aprobados; 62 archivos de prueba y 274
  pruebas aprobadas.

La política de antigüedad de dependencias conserva una excepción exacta y
auditable para `electron@44.1.0`; el lockfile pasó la verificación de cadena de
suministro de pnpm. No se añadió `serialport` ni otro binding nativo.
