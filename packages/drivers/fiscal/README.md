# @supermarket/driver-fiscal

Adaptadores para `FiscalPrinterPort` definidos por `@supermarket/core`.

Implementaciones:

- `FiscalPrinterFake` para tests y desarrollo, con respuestas deterministas configurables y transcripcion de comandos.
- drivers por proveedor fiscal certificado.
- adaptador de impresora térmica libre cuando corresponda.

Un driver fiscal no puede modificar entidades, agregados ni casos de uso.

El subpath `@supermarket/driver-fiscal/testing` expone el contract test que debe ejecutar cualquier adaptador futuro. `@supermarket/driver-fiscal/testing/fixtures` contiene la factura y la secuencia canonica `OPEN`, `ITEM`, `PAYMENT`, `CLOSE`.

La Fase 7 no incluye `SerialPort` ni acceso a hardware real.
