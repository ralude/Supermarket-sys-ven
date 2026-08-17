# 04. Entidades

Una entidad tiene identidad estable y un ciclo de vida. Sus atributos pueden cambiar, pero su identidad no se sustituye. La identidad debe ser independiente de la base de datos.

## Entidades previstas

| Módulo | Entidades |
|---|---|
| `catalog` | `Product`, `Category`, `UnitOfMeasure`, `Barcode`, `PriceHistory` |
| `currency` | `Currency`, `ExchangeRate`, `PaymentMethod` |
| `cash` | `CashRegister`, `Shift`, `CashMovement` |
| `sales` | `Sale`, `SaleItem`, `Payment`, `Discount`, `Return` |
| `fiscal` | `FiscalDocument`, `FiscalLine`, `FiscalDay`, `FiscalDevice` |
| `inventory` | `StockItem`, `Batch`, `StockMovement` |
| `purchasing` | `Supplier`, `PurchaseOrder`, `PurchaseOrderLine` |
| `customers` | `Customer` |
| `identity` | `User`, `Role`, `Permission` |

## Value objects obligatorios

### `Money`

Representa una cantidad como entero de unidades menores y un código ISO/configurado de moneda. Las operaciones entre monedas requieren una tasa explícita.

### `ExchangeRate`

Incluye moneda origen, moneda destino, valor escalado, fuente, vigencia y quién la registró. Una tasa no se sobreescribe históricamente.

### `FiscalId`

Representa RIF o identificación del cliente con tipo y valor normalizado. La validación final debe configurarse según las reglas fiscales vigentes.

### `Quantity`

Admite cantidades enteras y fraccionarias con escala definida por unidad de medida. No se usa `number` sin una política de precisión.

### Otros

`Barcode`, `UnitOfMeasure`, `TaxRate`, `Percentage`, `TerminalId`, `UserId`, `CurrencyCode` y `FiscalDocumentNumber` deben validar formato y normalización en sus constructores. `Barcode` tiene identidad dentro del agregado `Product`, aunque su valor normalizado sea la clave de búsqueda.

## Reglas

- Las entidades protegen sus invariantes; no exponen setters indiscriminados.
- Las fechas se almacenan y transportan en UTC.
- Los valores monetarios nunca se calculan con `float`.
- Los snapshots de productos y precios dentro de una venta preservan el valor aplicado, aunque el catálogo cambie después.
- `ProductSnapshot` conserva descripción, precio, impuesto, unidad y escala sin exponer una referencia mutable al agregado `Product`.
- `CashMovement` conserva un snapshot inmutable del método, moneda, monto positivo, dirección, actor, motivo y fecha; el signo contable se deriva del tipo de movimiento.
- `Permission` usa un código estable normalizado; `Role` agrupa permisos activos y asignables, y `User` deriva sus concesiones de roles activos sin almacenar credenciales.

## Fases

La Fase 0 documentó estas entidades. Las primitivas compartidas se prepararon en Fase 1 y las entidades de negocio se implementan desde la Fase 2 según el cronograma.
