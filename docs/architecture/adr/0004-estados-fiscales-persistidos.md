# ADR-0004: Estados fiscales persistidos

- Estado: Aceptado
- Fecha: 2026-08-05

## Contexto

Una impresora fiscal puede desconectarse después de recibir un comando. Un reinicio no debe provocar duplicación ni pérdida silenciosa del documento.

## Decisión

Los estados del documento, jornada y dispositivo serán máquinas explícitas y persistidas. Toda operación de hardware tendrá una política de reconciliación. La integración real se hará mediante `FiscalPrinterPort` y adaptadores de proveedores.

## Consecuencias

- Se puede recuperar una operación después de un crash.
- El flujo fiscal es más complejo que un simple `print()`.
- Los adaptadores deben informar estados suficientemente precisos.
- La certificación y validación legal del adaptador siguen siendo necesarias.
