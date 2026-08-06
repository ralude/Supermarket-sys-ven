# 05. Agregados

Un agregado es una frontera de consistencia. Solo su raíz se carga y modifica desde fuera. Las transacciones que cambian invariantes deben quedar dentro de esa frontera.

## Agregados previstos

| Agregado raíz | Responsabilidad | Invariantes principales |
|---|---|---|
| `Sale` | Venta, líneas y pagos | total consistente; no completar sin pago suficiente; estado válido |
| `FiscalDocument` | Documento fiscal y líneas | inmutable una vez emitido; corrección por nota fiscal |
| `Product` | Producto, códigos y precio vigente | barcode activo único; unidad válida; precio no negativo |
| `InventoryItem` | Stock y lotes | stock no negativo; salida FEFO cuando aplique |
| `Shift` | Turno y movimientos de caja | un turno abierto por caja; arqueo trazable |
| `PurchaseOrder` | Orden y recepción | recepción acumulada no supera cantidad ordenada |
| `User` | Identidad y credenciales | roles válidos; credencial nunca expuesta |

## Agregado `Sale`

Es la frontera principal del MVP. Contiene líneas con snapshot de descripción, precio, impuesto y cantidad, además de pagos registrados.

Debe garantizar:

- total de líneas, descuentos, impuestos e IGTF calculado de forma determinista;
- pago mixto con monedas y métodos permitidos;
- transición ordenada de `DRAFT` a `COMPLETED`;
- no modificar una venta completada;
- anulación con autorización y motivo;
- emisión de eventos solo por hechos válidos.

## Agregado `FiscalDocument`

Su estado de impresión se persiste por separado del contenido inmutable del documento. Un error de comunicación no debe crear silenciosamente un segundo documento.

## Consistencia entre agregados

Una venta no debe modificar directamente el agregado `Shift` o `InventoryItem`. El caso de uso coordina transacciones y eventos según la política definida. Si el flujo requiere atomicidad multiagregado, se debe documentar como una decisión específica y probarla con SQLite.

## Fase 0

No se implementan agregados funcionales. Se fijan sus límites para evitar que la primera implementación convierta las tablas en el modelo de dominio.
