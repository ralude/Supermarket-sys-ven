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

## Reconciliación

Al iniciar el nodo se consultan documentos `PRINTING`, `ERROR` o `RETRYING`, se compara el estado persistido con el dispositivo y se decide continuar, marcar emitido o escalar a intervención.

## Fase 0

Solo se define la máquina de estados, el puerto y las reglas de recuperación. No se instala ni integra hardware real.
