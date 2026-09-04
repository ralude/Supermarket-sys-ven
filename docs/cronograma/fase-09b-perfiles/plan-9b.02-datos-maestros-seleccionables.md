# Plan de ejecución 9B.02: Datos maestros seleccionables y entrada de dinero uniforme

- **Sub-fase:** [9B.02 Datos maestros seleccionables](./9b.02-datos-maestros-seleccionables.md)
- **Estado del plan:** Ejecutado; decisión de la caja de la estación resuelta por los datos (ver sub-fase)
- **Prerrequisito:** [9B.01 Reestructuración del renderer](./9b.01-reestructuracion-renderer.md)
- **Disciplina visual:** Ponytail `full`, limitada a presentación
- **Modo fiscal permitido:** `SIMULACION` mediante `FiscalPrinterFake`

## Resultado esperado

Ninguna pantalla exige escribir un identificador interno. El operador elige productos, cajas,
métodos de pago, categorías y unidades de listas que publica el nodo, y el dinero se captura
igual en todas las pantallas. La interfaz deja de poder construir solicitudes que el dominio
rechazará por un dato que ella misma pudo derivar.

## Línea base comprobada

- Los cuatro puertos de datos maestros solo permiten búsqueda puntual:
  `CashRegisterRepository.findById`, `CategoryRepository.findById`,
  `UnitOfMeasureRepository.findByCode` y `PaymentMethodRepository.findByCode`. **Ninguno
  ofrece listado**, de modo que la lectura hay que construirla.
- `CatalogReadRepository.findAll()` sí existe y respalda el listado de productos ya publicado.
- `bootstrapOperations` siembra una caja por terminal y los métodos `CASH` y `CARD`; las
  categorías y unidades llegan con la siembra de productos.
- Campos que hoy se escriben a mano: `cashRegisterId` y `paymentMethodCode` en caja;
  `productId`, `stockItemId`, `supplierId` y `receiptId` en inventario; `categoryId` y
  `unitCode` en el alta de catálogo.
- Catálogo pide el precio en unidades menores crudas con un campo numérico, mientras la venta
  ya usa `parseMinorUnits` sobre un campo decimal.
- La venta pide al cajero la "Escala" de la cantidad. `SaleItem.create` exige que esa escala
  coincida con `snapshot.unitScale` y rechaza el desajuste con
  `SALE_ITEM_QUANTITY_SCALE_MISMATCH`: el valor correcto siempre es derivable del producto.
- La pantalla de caja codifica `'USD'` en apertura, movimiento y cierre, mientras
  `PaymentMethod` ya declara su propia moneda.

## Decisiones de frontera

### Lecturas de datos maestros

Cada puerto de configuración se extiende con una operación de listado y su adaptador. La
lectura exige sesión válida y ningún permiso adicional, igual que las demás lecturas de
catálogo y moneda que fija ADR-0012.

Los listados de configuración no llevan cursor ni límite: son conjuntos cerrados y pequeños
que el propio nodo administra. El listado de productos conserva la forma que ya tiene. Un
listado devuelve solo registros activos; los inactivos no se ofrecen para elegir.

### Escala y unidad de la cantidad

La escala de cantidad deja de ser un campo del formulario y se deriva de la unidad del
producto elegido, junto con su `stockItemId`. Esto no es una preferencia de presentación: el
dominio ya declara que el único valor válido es el de la unidad del producto, de modo que
pedirlo sólo permite construir una solicitud inválida. Al terminar esta sub-fase la interfaz
no puede producir `SALE_ITEM_QUANTITY_SCALE_MISMATCH`.

### Entrada de dinero

Toda entrada de dinero usa el mismo parser decimal contra la escala de su moneda, incluida la
de catálogo. Un valor con más decimales que la moneda se rechaza en la interfaz con un
mensaje público, antes de viajar. No se introduce ninguna aritmética de punto flotante: el
parser sigue produciendo unidades menores enteras.

### Moneda de la operación de caja

La moneda de la apertura, el movimiento y el cierre proviene del método de pago elegido, que
ya la declara. Deja de estar codificada en el renderer.

## Decisiones requeridas antes de implementar

1. **Cómo se determina la caja de la estación.** Hoy `bootstrapOperations` crea exactamente
   una caja por terminal y el renderer la recuerda en almacenamiento local. Si una estación
   tiene siempre una sola caja, un selector es ruido y el dato pertenece a la configuración
   del nodo; si puede tener varias, el selector es necesario. Es una decisión operativa del
   negocio, no de presentación, y no se resuelve eligiendo el comportamiento más cómodo.

Las demás decisiones de frontera son de ingeniería y no requieren aprobación externa.

## Secuencia outside-in

1. Probar los listados de datos maestros: exigen sesión válida, devuelven solo registros
   activos y conservan una forma estable.
2. Probar que la unidad, la escala y el `stockItemId` se derivan del producto elegido.
3. Probar que la entrada decimal produce las mismas unidades menores en catálogo y en venta, y
   que rechaza una escala mayor a la de la moneda con un mensaje público.
4. Probar que el movimiento de caja toma la moneda del método de pago elegido.
5. Extender puertos y adaptadores, publicar los contratos de lectura y sustituir cada campo
   crudo por su selector.
6. Verificar que ninguna pantalla conserva un campo de identificador interno.

## Criterios de aceptación

- [ ] Ninguna pantalla pide escribir `cashRegisterId`, `stockItemId`, `productId`,
  `categoryId`, `unitCode` ni `paymentMethodCode`.
- [ ] El `stockItemId`, la unidad y la escala de cantidad se derivan del producto elegido, y el
  campo "Escala" desaparece de la pantalla de venta.
- [ ] La interfaz ya no puede producir `SALE_ITEM_QUANTITY_SCALE_MISMATCH`.
- [ ] Toda entrada de dinero usa el mismo parser decimal y rechaza una escala mayor a la de su
  moneda con un mensaje público, sin aritmética de punto flotante.
- [ ] La moneda de la operación de caja proviene del método de pago; no queda ningún `'USD'`
  codificado en el renderer.
- [ ] Los listados exigen sesión válida y no exponen registros inactivos.
- [ ] Ningún cálculo de negocio se trasladó al renderer.
- [ ] `pnpm test`, `pnpm typecheck` y `pnpm lint` quedan verdes.

## Fuera de alcance

- Alta y edición de datos maestros: pertenecen a 9B.10.
- Selectores de proveedor y de cliente: llegan con 9B.03 y 9B.05, junto a su capacidad.
- Paginación y rangos rápidos de reportes: pertenecen a 9B.13.
- El campo `receiptId` de una recepción, que es un dato del documento del proveedor y no un
  identificador interno del sistema.
