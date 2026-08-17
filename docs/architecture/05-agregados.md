# 05. Agregados

Un agregado es una frontera de consistencia. Solo su raíz se carga y modifica desde fuera. Las transacciones que cambian invariantes deben quedar dentro de esa frontera.

## Agregados previstos

| Agregado raíz | Responsabilidad | Invariantes principales |
|---|---|---|
| `Sale` | Venta, líneas y pagos | total consistente; no completar sin pago suficiente; estado válido |
| `FiscalDocument` | Documento fiscal y líneas | inmutable una vez emitido; corrección por nota fiscal |
| `Product` | Producto, códigos, precio vigente e historial de precios | barcode activo único; unidad válida; precio no negativo; cambios de precio append-only |
| `StockItem` | Stock, lotes y movimientos | saldo derivado; stock y saldo por lote no negativos |
| `Shift` | Turno y movimientos de caja | un turno abierto por caja; arqueo trazable |
| `PurchaseOrder` | Orden y recepción | recepción acumulada no supera cantidad ordenada |
| `User` | Identidad y concesiones | roles activos, asignables y sin duplicados; sin credenciales en Fase 2 |

El agregado `Product` contiene barcodes, precio vigente e historial append-only.
Los códigos activos también se comprueban globalmente mediante el puerto del
repositorio antes de guardar; la restricción transaccional definitiva pertenece
a la persistencia de Fase 3. `Category` y `UnitOfMeasure` se validan como
configuración externa del agregado, mientras el producto conserva la referencia
de categoría y el código/escala de unidad usados por su snapshot.

## Agregado `Sale`

Es la frontera principal del MVP. Contiene líneas con snapshot de descripción, precio, impuesto y cantidad, además de pagos registrados.

Debe garantizar:

- total de líneas, descuentos, impuestos e IGTF calculado de forma determinista;
- precio de snapshot neto de IVA; descuento porcentual por línea antes del IVA y redondeo por línea;
- pago mixto con monedas y métodos permitidos;
- lote de pagos exacto, con tasa explícita y snapshot del método cuando corresponda;
- transición ordenada de `DRAFT` a `COMPLETED`;
- no modificar una venta completada;
- anulación únicamente de `DRAFT`, con autorización y motivo;
- emisión de eventos solo por hechos válidos.

El IGTF no se codifica como una constante del agregado: la aplicación recibe una
política versionada que determina elegibilidad, tasa y base cubierta por pagos
elegibles. Registrar el lote de pagos congela líneas y descuentos.

## Agregado `Shift`

`Shift` es la raíz del ciclo de caja. `CashRegister` representa la caja
configurada y `CashMovement` pertenece al turno. El agregado garantiza:

- ownership único por terminal y nodo;
- estado `OPEN` o `CLOSED` y ausencia de movimientos después del cierre;
- fondos iniciales, ingresos y retiros manuales como movimientos inmutables;
- montos positivos, motivo y actor obligatorios;
- retiros que no superan el saldo de su moneda y método;
- balances independientes por moneda y método, sin conversiones implícitas;
- arqueo con snapshots de esperado, declarado y diferencia;
- eventos versionados `ShiftOpened`, `CashMovementRegistered` y `ShiftClosed`.

En Fase 2, la regla de un turno abierto por caja se consulta mediante
`ShiftRepository`. La restricción transaccional se añade con SQLite. Los
movimientos derivados de ventas, auditoría y autorización de diferencias
pertenecen a la Fase 5.

## Agregado `User`

`User` conserva roles configurables y deriva sus permisos efectivos sin copiar
concesiones. Un usuario inactivo, un rol inactivo o un permiso inactivo siempre
deniega la operación. Solo se asignan roles y permisos marcados como
asignables, y no se permiten duplicados por identidad o código. Contraseñas,
PIN, tokens, sesiones y cifrado pertenecen a la Fase 11.

## Agregado `StockItem`

`StockItem` inicia con saldo cero y solo cambia mediante movimientos
append-only. Cada movimiento usa la escala configurada del producto, conserva
actor, motivo, referencia y timestamp, y deriva la dirección de uno de estos
tipos: recepción de compra, salida de venta, merma, ajuste positivo o ajuste
negativo. Las salidas nunca pueden dejar saldo negativo.

Cuando `tracksBatches` está activo, todo movimiento exige un lote registrado y
la disponibilidad se valida por lote. Sin esa marca, no se aceptan lotes. La
selección FEFO, el consumo idempotente de ventas, el kardex y la reconciliación
offline pertenecen a la Fase 6.

## Agregado `FiscalDocument`

Su estado de impresión se persiste por separado del contenido inmutable del documento. Un error de comunicación no debe crear silenciosamente un segundo documento.

## Consistencia entre agregados

Una venta no debe modificar directamente el agregado `Shift` o `StockItem`. El caso de uso coordina transacciones y eventos según la política definida. Si el flujo requiere atomicidad multiagregado, se debe documentar como una decisión específica y probarla con SQLite.

## Ownership entre nodos

Cada agregado tiene un único nodo con autoridad de escritura. Una venta, turno o documento fiscal pertenece a su terminal de origen; otro nodo solo consume sus eventos o proyecciones. Catálogo y configuración se originan en el coordinador de tienda. La matriz completa y la política de inventario offline están en [12. Sincronización y ownership](./12-sincronizacion-y-ownership.md).

## Fase 0

No se implementan agregados funcionales. Se fijan sus límites para evitar que la primera implementación convierta las tablas en el modelo de dominio.
