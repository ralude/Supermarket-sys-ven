# 09. Estados fiscales

## Alcance

Los estados fiscales deben persistirse y poder reconciliarse después de reinicios, cortes eléctricos, pérdida de red o error del dispositivo. La arquitectura prepara adaptadores calificados por una matriz explícita, pero no implementa cumplimiento legal por sí sola.

## Documento fiscal

```text
PENDING -> PRINTING -> ISSUED
                  \-> ERROR -> RETRYING -> ISSUED
                                      \-> FAILED
```

Reglas:

- `ISSUED` es inmutable.
- `FAILED` requiere intervención o una política de recuperación explícita.
- `retryable` solo habilita un nuevo intento; no decide terminalidad. Un fallo
  no reintentable permanece `ERROR` y bloquea mientras no exista evidencia
  autoritativa de `NOT_APPLIED + NOT_COMMITTED` con entrega incompleta.
- `FAILED` no se alcanza automáticamente desde un error de adaptador. Efecto o
  compromiso `UNKNOWN`, y un simple `REJECTED`, exigen reconciliación o
  intervención porque no prueban por sí solos ausencia de efecto fiscal.
- No se reintenta a ciegas si no se conoce si el dispositivo imprimió.
- Una corrección debe generar el documento fiscal permitido, por ejemplo una nota de crédito cuando corresponda.

## Jornada fiscal

```text
DAY_CLOSED -> DAY_OPEN -> Z_PENDING -> Z_ISSUED -> DAY_CLOSED
```

La política de bloqueo de ventas cuando existe una jornada pendiente debe configurarse con base en el equipo y la normativa aplicable.

## Dispositivo fiscal

El estado no se modela como una sola cadena que confunda puerto, actividad y
condición. Se observan al menos tres dimensiones:

```text
transporte:    CLOSED -> OPENING -> OPEN -> CLOSING | DISCONNECTED | QUARANTINED
compatibilidad: UNKNOWN -> PROBING -> READY | INCOMPATIBLE | RECOVERY_REQUIRED
actividad:      IDLE <-> TRANSACTING | RECONCILING
condición:      UNKNOWN | OK | PAPER_END | BUSY | MEMORY_WARNING | FISCAL_ERROR
```

Los valores concretos se ajustan mediante el mapa propio de cada perfil
soportado. Falta de papel,
tapa abierta, memoria fiscal llena, documento abierto, cierre requerido o
desconexión deben convertirse en estados explícitos, no en mensajes genéricos.
Que el puerto esté abierto no significa que la impresora esté identificada,
compatible o lista para emitir.

`RECONNECT_WAIT` es una política temporal de la proyección operativa, no un
estado del lifecycle físico: durante la espera el transporte permanece
`DISCONNECTED` o `QUARANTINED` según conserve un I/O/lock incierto.

## Puerto de hardware

El contrato previsto es:

```text
FiscalPrinterPort
  getStatus()
  printInvoice(document)
  printCreditNote(document)
  printXReport()
  printZReport()
```

Adaptadores previstos:

- `FiscalPrinterFake` para tests y desarrollo.
- adaptadores de fabricante/familia con modelo autorizado y compatibilidad
  técnica confirmada independientemente;
- adaptador de impresora térmica libre, si el producto y la regulación lo permiten.

## Contrato semántico y evidencia vigente

La Fase 7 cerró inicialmente los fallos con una certeza única
`NOT_SENT | REJECTED | UNKNOWN`. La retrospectiva demostró que esa dimensión no
distinguía lo que hizo el host, el efecto observado en el equipo, el compromiso
fiscal ni la entrega física. El gate 8.00 sustituyó ese modelo por
`FiscalOperationEvidence` con cuatro ejes independientes:

- `dispatchState`: `NOT_STARTED | STARTED | RESULT_RECEIVED`;
- `commandEffect`: `APPLIED | NOT_APPLIED | REJECTED | UNKNOWN`;
- `fiscalCommit`: `COMMITTED | NOT_COMMITTED | UNKNOWN`;
- `printDelivery`: `COMPLETE | INCOMPLETE | UNKNOWN`.

Un documento puede quedar `ISSUED` con `APPLIED + COMMITTED` aunque la entrega
sea `INCOMPLETE` o `UNKNOWN`; eso exige recuperación/copia permitida, nunca una
segunda emisión. Un retry solo es elegible cuando no existe ninguna dimensión
relevante `UNKNOWN` y la evidencia demuestra que el intento no comenzó o que
no produjo ni comprometió el efecto fiscal. Una consulta posterior puede
confirmar efecto/compromiso, pero no fabricar una respuesta del comando original.

`FiscalPrinterFake` registra una transcripcion semantica
`OPEN -> ITEM -> PAYMENT -> CLOSE`, permite programar ACK, NAK, falta de papel,
memoria llena, busy, timeout, CRC y puerto cerrado, y confirma de forma
determinista facturas, notas de credito y reportes X/Z. Esa transcripcion valida
el comportamiento semantico del fake, no bytes, framing, encoding, checksum ni
estados de un proveedor. Las suites comunes se ejecutan solo contra simuladores;
X/Z están separados detrás de consentimiento simulado explícito. HIL y cualquier
Z real tienen autorización, presupuesto y runbook propios.

## Frontera de genericidad de la integración

El contrato semantico puede ser comun, pero el protocolo o runtime fiscal no se
presume universal:

```text
FiscalPrinterPort
  -> adaptador de familia/proveedor
    ├─ si la vía oficial es serial:
    │    codec/status mapper -> transporte SerialPort -> puerto COM
    └─ si la vía oficial es SDK/DLL:
         gateway nativo aislado -> interfaz autorizada del proveedor
```

Cada adaptador declara fabricante, familia, modelos, version de protocolo o SDK,
firmware permitido, conexion, parametros seriales cuando apliquen, DLL y
licencia cuando correspondan, encoding, comandos soportados y evidencia
disponible para reconciliar. La seleccion se valida con consultas no mutantes y
la evidencia de instalacion que el perfil requiera; no se elige una impresora
por el primer puerto COM disponible.

La [ADR-0010](./adr/0010-transporte-serial-y-protocolos-fiscales.md) fija esta
frontera y prohibe reproducir automaticamente tramas fiscales persistidas.

## Reconciliación

Al iniciar el nodo se deben consultar documentos y reportes recuperables antes
de aceptar otra operacion fiscal. El gate 8.00 ya implementó consultas para
`PENDING`, `PRINTING`, `ERROR` y `RETRYING` y las probó después de reabrir
SQLite. El orquestador de startup está diseñado, pero su implementación/composición
pertenece a 8.04 cuando exista evidencia autoritativa del primer perfil. También
falta `ReconcileFiscalReport` para X/Z.

La migración forward-only 0010 añade y persiste los cuatro ejes neutrales en
documentos, jornadas y transiciones, y migra datos anteriores sin convertir
`NOT_SENT` en permiso de retry. La 0011 neutraliza las columnas históricas tras
el backfill, impide volver a escribirlas y añade guards SQLite para evidencia
completa/coherente, contenido fiscal sellado y pertenencia jornada–reporte. Una
emisión terminal heredada se conserva como `APPLIED + COMMITTED` con entrega
`UNKNOWN`. Un timeout o CRC puede quedar en `ERROR` incluso si el cierre está
comprometido; `ReconcileFiscalState` solo marca `ISSUED` con evidencia positiva
y una referencia distinta conserva el bloqueo.

En hardware real, que una referencia no sea el ultimo documento observado no
demuestra que nunca fue emitida. La reconciliacion por proveedor debe producir
evidencia positiva de `ISSUED` o `NOT_ISSUED`; si solo puede concluir `UNKNOWN`,
se bloquea el dispositivo y se escala a intervencion. La misma regla aplica a un
Reporte Z, cuyo timeout nunca habilita otro cierre a ciegas.

## Estado de implementacion

La Fase 7 completó el puerto semántico, el fake y la persistencia sin hardware
real. El gate 8.00 ya cerró la portabilidad segura del harness, la evidencia
neutral, las migraciones 0010/0011, la consulta recuperable de documentos/reportes y la
reconciliación fail-closed heredada. Siguen pendientes los campos fiscales
abiertos, la evidencia formal del primer proveedor, el runtime nativo y la
reconciliación X/Z; por eso no se agrega SerialPort de producción ni se declara
ningún perfil soportado todavía.
