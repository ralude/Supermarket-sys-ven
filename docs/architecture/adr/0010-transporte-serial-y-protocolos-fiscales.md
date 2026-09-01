# ADR-0010: Transporte serial común e integraciones fiscales por proveedor

- Estado: Aceptado
- Fecha: 2026-08-30

## Contexto

La Fase 7 dejó un `FiscalPrinterPort` semántico y un fake que transcribe
`OPEN`, `ITEM`, `PAYMENT` y `CLOSE`. Esa transcripción no es un protocolo de
bytes. Las máquinas fiscales autorizadas en Venezuela exponen programas de
control, comandos, estados, encodings, checksums y capacidades de
reconciliación que dependen del fabricante, familia, modelo y firmware.

El texto de la Providencia SNAT/2018/0141 establece que el software debe
adaptarse a las especificaciones de funcionamiento de la impresora y que el
desarrollador debe registrarse ante el fabricante o representante autorizado.
Su vigencia y aplicabilidad concreta se revalidan en 8.00. Presentar un único
parser como compatible con cualquier impresora fiscal sería técnicamente
incorrecto y no tendría evidencia regulatoria suficiente.

## Decisión

La genericidad se limita a fronteras explícitas:

1. `FiscalPrinterPort` conserva el contrato semántico que usa aplicación.
2. El transporte serial común solo administra bytes, apertura, cierre,
   escritura con `drain`, lectura, exclusividad, timeouts y desconexiones.
3. Cada familia de integración fiscal tiene un adaptador propio dentro de
   `packages/drivers/fiscal`; no se seleccionan comandos por condicionales de
   modelo dentro de un parser universal.
4. Para un perfil cuyo protocolo oficial sea serial, la implementación nativa
   de SerialPort queda aislada en `packages/drivers/hardware`; el adaptador
   fiscal recibe un contrato mínimo de transporte de bytes y el servidor
   compone ambas piezas. Si la vía oficial es un SDK, DLL u otro transporte, un
   gateway nativo específico del proveedor queda aislado detrás del adaptador
   de esa familia: no finge una interfaz de bytes ni obliga a reutilizar
   SerialPort. En ninguna ruta se importan internals ni se filtran tipos nativos
   fuera de infraestructura.
5. Un único proceso privilegiado del nodo es dueño del dispositivo y de su
   runtime nativo. El renderer no recibe rutas, handles, bytes, APIs de
   SerialPort ni tipos o funciones del SDK/DLL del proveedor.
6. El dispositivo se selecciona por configuración validada. Consultas no
   mutantes verifican automáticamente los atributos de identidad/capacidad que
   el protocolo exponga; etiqueta, registro de instalación y autorización
   completan los demás. Un atributo obligatorio no verificable falla cerrado.
   `SerialPort.list()` solo sirve como diagnóstico; nunca autoriza ni selecciona
   automáticamente una impresora.
7. La cola de transporte es single-flight y vive en memoria. El estado durable
   del documento o reporte conserva la intención local y enumera qué
   reconciliar; status, contadores, memoria y reportes del equipo aportan
   evidencia del efecto fiscal. No se persisten tramas con la intención de
   reproducirlas automáticamente después de un reinicio.
8. Un comando fiscal no idempotente solo se reintenta cuando la evidencia que
   exige el protocolo seleccionado confirma que no tuvo efecto. Un `write()` o
   `drain()` exitoso no demuestra que el equipo procesó el comando.
9. Cada combinación se declara soportada solo después de validar manual o
   especificación oficial, versión de protocolo o SDK, modelo y firmware
   permitidos, autorización vigente del modelo, compatibilidad técnica
   confirmada por separado, registro con el fabricante, contract tests, pruebas
   de hardware y escenarios de recuperación.
10. El driver fiscal coexiste con el DCTD en la topología autorizada. No lo
    sustituye, configura ni usa su canal para transmitir al sistema centralizado
    salvo un alcance futuro separado, documentado y autorizado.

La evidencia conserva dimensiones separadas: dispatch semántico, efecto del
comando, compromiso/registro fiscal y entrega impresa. `WRITE_INVOKED` y
`OS_DRAINED` son telemetría interna del adaptador serial y se traducen a
`dispatchState`; no contaminan `FiscalPrinterPort`. «No se invocó `write()`»
describe ese intento local; «el dispositivo confirma que no aplicó el efecto»
describe el resultado fiscal. Una consulta posterior no puede convertir lo
segundo en «no enviado», y un documento comprometido fiscalmente puede todavía
tener una impresión incompleta. Un gateway SDK/DLL conserva su propia
telemetría interna y la traduce al mismo resultado semántico sin inventar etapas
seriales.

## Propiedad del proceso

El servicio fiscal local del nodo es el único owner lógico y se compone en el
límite operativo del servidor que posee SQLite. El gate correspondiente decide
el runtime físico. El corte 8.00 del 2026-08-31 selecciona un proceso hijo
supervisado y dedicado por dispositivo lógico para el binding SerialPort o
gateway SDK/DLL que pueda bloquearse. `apps/server` conserva readiness y
ownership lógico; el hijo conserva el único handle físico. Electron puede
iniciar o supervisar el servidor, pero renderer, preload, rutas Fastify y el
proceso que mantiene SQLite abierto no cargan el binding ni abren otra
instancia.

Un deadline no autoriza crear otro owner. El supervisor deja de aceptar trabajo,
intenta el cierre cooperativo, termina el PID anterior si no responde y verifica
que el recurso quedó libre antes de crear un reemplazo. Si no puede demostrarlo,
el dispositivo permanece `QUARANTINED`. El lifecycle detallado y las pruebas
pendientes están en
[`runtime-nativo-8.00.md`](../../cronograma/fase-08-integracion-serial/runtime-nativo-8.00.md).

## Consecuencias

- Agregar otro fabricante implica un nuevo adaptador y una matriz de
  compatibilidad, no cambios al dominio.
- La Fase 8 se cierra con dos perfiles exactos calificados de forma independiente:
  un candidato PNP y un candidato The Factory HKA/ACLAS. Si un candidato no
  supera su gate se sustituye mediante una decisión de alcance; no se rebaja el
  criterio silenciosamente.
- Esos dos perfiles no anuncian compatibilidad genérica con todos los modelos de
  PNP, ACLAS ni con todas las impresoras venezolanas.
- El contrato fake debe separarse de sus controles de simulación antes de
  poder certificar un adaptador real.
- La revisión normativa vigente, la autorización por modelo y el registro ante
  fabricante son gates de piloto y producción, no propiedades que el código
  pueda asumir. SNAT/2024/000121 fue derogada por SNAT/2026/00084 y no se usa
  como obligación vigente.
- La recuperación es más conservadora: ante evidencia insuficiente se bloquea
  la operación y se solicita intervención en vez de reimprimir.
- La autorización jurídica del modelo y la compatibilidad técnica de
  firmware/protocolo/interfaz/plataforma se registran como evidencias distintas.
- Una integración SDK/DLL incorpora a su matriz licencia, versión,
  arquitectura, packaging, aislamiento y recuperación del runtime nativo; no
  hereda por analogía la evidencia del transporte SerialPort.
- La topología DCTD forma parte de la matriz HIL y del runbook de instalación.

## Fuentes

Las fuentes primarias, de fabricante y técnicas consultadas, con su alcance y
fecha de revisión, se mantienen en
[`docs/cronograma/fase-08-integracion-serial/fuentes-oficiales.md`](../../cronograma/fase-08-integracion-serial/fuentes-oficiales.md).
