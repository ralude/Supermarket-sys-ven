# 09. Estados fiscales

## Alcance

Los estados fiscales deben persistirse y poder reconciliarse después de reinicios, cortes eléctricos, pérdida de red o error del dispositivo. La arquitectura prepara adaptadores fiscales certificados, pero no implementa cumplimiento legal por sí sola.

## Documento fiscal

```text
PENDING -> PRINTING -> ISSUED
                  \-> ERROR -> RETRYING -> ISSUED
                                      \-> FAILED
```

Reglas:

- `ISSUED` es inmutable.
- `FAILED` requiere intervención o una política de recuperación explícita.
- No se reintenta a ciegas si no se conoce si el dispositivo imprimió.
- Una corrección debe generar el documento fiscal permitido, por ejemplo una nota de crédito cuando corresponda.

## Jornada fiscal

```text
DAY_CLOSED -> DAY_OPEN -> Z_PENDING -> Z_ISSUED -> DAY_CLOSED
```

La política de bloqueo de ventas cuando existe una jornada pendiente debe configurarse con base en el equipo y la normativa aplicable.

## Dispositivo fiscal

```text
OFFLINE -> CONNECTED -> IDLE <-> PRINTING
```

Errores como falta de papel, tapa abierta, memoria fiscal llena o desconexión deben convertirse en estados explícitos, no en mensajes genéricos.

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
- adaptador de proveedor fiscal certificado;
- adaptador de impresora térmica libre, si el producto y la regulación lo permiten.

## Contrato implementado en la Fase 7

`FiscalPrinterPort` devuelve resultados discriminados y nunca expone mensajes genericos del dispositivo. Cada fallo contiene un codigo estable, si admite reintento y una certeza de entrega:

- `NOT_SENT`: el comando no fue enviado y puede reintentarse segun la politica.
- `REJECTED`: el dispositivo rechazo el comando; requiere corregir la causa.
- `UNKNOWN`: no se sabe si el dispositivo lo proceso; primero se reconcilia.

`FiscalPrinterFake` registra una transcripcion semantica `OPEN -> ITEM -> PAYMENT -> CLOSE`, permite programar ACK, NAK, falta de papel, memoria llena, busy, timeout, CRC y puerto cerrado, y confirma de forma determinista facturas, notas de credito y reportes X/Z. Los fixtures y el contract test se reutilizaran sin cambios de comportamiento en el adaptador serial.

## Reconciliación

Al iniciar el nodo se consultan documentos `PRINTING`, `ERROR` o `RETRYING`, se compara el estado persistido con el dispositivo y se decide continuar, marcar emitido o escalar a intervención.

La Fase 7 persiste documentos, lineas, pagos, transiciones, jornadas y reportes mediante una migracion forward-only. Un timeout o CRC al cerrar un documento queda en `ERROR` con certeza `UNKNOWN`; `ReconcileFiscalState` consulta el ultimo documento confirmado antes de permitir cualquier reintento. La prueba de integracion cierra y reabre SQLite para verificar que la recuperacion no vuelve a enviar comandos.

## Estado de implementacion

La Fase 7 completa el contrato, el fake, la persistencia y la recuperacion sin hardware real. La conexion serial, el parser y la cola del dispositivo corresponden exclusivamente a la Fase 8.
