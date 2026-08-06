# @supermarket/driver-fiscal

Adaptadores para `FiscalPrinterPort` definidos por `@supermarket/core`.

Implementaciones previstas:

- `FiscalPrinterFake` para tests y desarrollo.
- drivers por proveedor fiscal certificado.
- adaptador de impresora térmica libre cuando corresponda.

Un driver fiscal no puede modificar entidades, agregados ni casos de uso.
