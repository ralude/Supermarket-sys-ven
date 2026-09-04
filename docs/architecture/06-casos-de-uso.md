# 06. Casos de uso

Los casos de uso son la API de aplicación. Orquestan una intención del usuario o de un proceso, pero no contienen detalles de HTTP, Electron, SQL ni UI.

## Flujo estándar

```text
DTO de entrada + contexto de ejecución
  -> validación de forma
  -> validar identidad y autorización
  -> cargar agregado mediante puerto
  -> ejecutar comportamiento del dominio
  -> persistir en Unit of Work
  -> guardar eventos en outbox
  -> devolver DTO de salida
```

## Casos de uso del MVP posterior

### `catalog`

- `CreateProduct`
- `UpdateProduct`
- `UpdatePrice`
- `FindProductByBarcode`

Los comandos de catálogo validan `Category` y `UnitOfMeasure` mediante puertos,
comprueban conflictos de barcodes activos y devuelven un snapshot serializable
para `sales`. `UpdatePrice` es la única operación que modifica el precio y
registra `PriceHistory`; la persistencia del agregado, ledger y outbox queda en
las fases correspondientes.

### `currency`

- `UpdateExchangeRate`
- `GetCurrentExchangeRate`
- `GetExchangeRateHistory`
- `GetSuggestedExchangeRate`
- `CalculateMixedPaymentTotals`

Desde Fase 9, los comandos de catálogo y moneda reciben `ExecutionContext` y
autorizan `catalog.product.create`, `catalog.product.update`,
`catalog.price.update` o `currency.rate.update` antes de cualquier efecto. Sus
lecturas solo requieren la sesión verificada por HTTP. La fuente de políticas
operativas y el comportamiento fail-closed se fijan en ADR-0012.

Desde 9.07, `GetExchangeRateHistory` proyecta el histórico local de un par con
límite acotado (1-500, 100 por defecto) y orden determinista, y
`GetSuggestedExchangeRate` es una lectura pura sobre el puerto
`ExchangeRateProvider` que nunca persiste ni sustituye a `UpdateExchangeRate`.
Ambas exigen solo sesión verificada, igual que las demás lecturas de moneda.
ADR-0014 fija esas reglas y deja explícitamente diferida la aprobación de un
proveedor externo concreto; sin uno configurado, la sugerencia falla cerrado
con `EXCHANGE_RATE_PROVIDER_NOT_CONFIGURED` sin afectar la tasa vigente.

### `cash`

- `OpenShift`
- `RegisterCashMovement`
- `CloseShift`

En Fase 2, estos casos de uso validan ownership con `ExecutionContext`, métodos
de efectivo mediante `PaymentMethodRepository` y permisos mediante
`AuthorizationService`. `CashRegisterRepository` localiza la caja y
`ShiftRepository` abstrae guardado, búsqueda y detección de un turno abierto.
La implementación usa fakes: persistencia, auditoría, idempotencia y consumo de
pagos de venta se incorporan en sus fases correspondientes.

### `sales`

- `StartSale`
- `AddItemToSale`
- `RemoveItemFromSale`
- `ApplyDiscountToSale`
- `RegisterMixedPayment`
- `CompleteSale`
- `VoidSale`
- `GetSale` para recuperar la venta del terminal/nodo autenticado.

En la Fase 2, `ExecutionContext` identifica al actor y
`AuthorizationService` es la frontera estable para autorizar descuentos,
anulaciones y operaciones sensibles de caja. `User`, `Role` y `Permission`
expresan las concesiones sin autenticar el transporte. `RegisterMixedPayment`
recibe un lote atómico, exige tasas explícitas para conversiones y conserva el
snapshot del método y de la tasa utilizada.

En 9.00, todas las mutaciones de venta son idempotentes por nodo y operación;
las consultas y comandos posteriores a `StartSale` rechazan como inexistente
una venta que no pertenezca al terminal/nodo del contexto.

### `inventory`

La Fase 2 expone únicamente el agregado puro `StockItem`; no crea casos de uso,
DTO ni repositorios. Recepciones operativas, consumo de `SaleCompleted`, mermas,
ajustes autorizados y consultas de kardex se implementan en la Fase 6.

### `purchasing`

- `CreateSupplier`
- `UpdateSupplier`
- `ChangeSupplierStatus`
- `CorrectSupplierTaxIdentity`
- `GetSupplier`
- `ListSuppliers`

Desde 9B.03, los comandos autorizan `supplier.create`, `supplier.update` o
`supplier.tax_identity.correct`; las lecturas exigen sesión verificada. La
identidad fiscal se normaliza en dominio y su unicidad se confirma en la misma
transacción. El tipo fiscal lo determina el país (`RIF` en Venezuela, `TAX_ID`
en el resto) y el dominio rechaza cualquier otra combinación; la dirección
fiscal es opcional pero solo se acepta completa. La recepción de inventario carga el proveedor mediante puerto y
solo acepta estado `ACTIVE`. `PurchaseReceipt` y su finalización completa se
incorporan con el costo en 9B.04, como fija ADR-0019.

`ReceivePurchase` recibe únicamente producto, cantidad escrita como decimal,
proveedor, recibo, motivo y lote opcional. El artículo de inventario, su ID, su
unidad y su escala los resuelve la aplicación mediante los puertos de inventario
y catálogo; ningún transporte los envía. La cantidad se escala con la unidad
derivada, de modo que más decimales de los admitidos se rechazan antes de crear
evidencia.

### `fiscal`

- `IssueFiscalDocument`
- `PrintXReport`
- `PrintZReport`
- `ReconcileFiscalState`

### `reporting`

- `GetCashClosureReport`
- `GetAuditReport`
- `GetFiscalOperationsReport`

Desde 9.06 son lecturas puras: autorizan `reports.cash.read`,
`reports.audit.read` o `reports.fiscal.read` antes de consultar, proyectan desde
puertos de lectura propios y no cargan ni modifican agregados. El período UTC y
los filtros son opcionales; el límite de filas no lo es y se recorta en
aplicación. La auditoría no proyecta los resúmenes antes/después y la fiscalidad
se rotula siempre como simulación. ADR-0013 fija permisos, alcance, exportación
y el origen manual de la jornada de X/Z.

## Puertos de aplicación

Los primeros contratos previstos son:

- repositorios por agregado;
- `UnitOfWork` transaccional;
- `FiscalPrinterPort`;
- `EventPublisher`;
- `Clock`;
- `IdGenerator`;
- `AuthorizationService`;
- `AuditWriter`.

## Contexto de ejecución

Todo comando recibe metadatos separados del DTO de negocio:

- `actorId` y roles o concesiones verificadas;
- `terminalId` y `originNodeId`;
- `correlationId`;
- `idempotencyKey` cuando el comando pueda reintentarse;
- timestamp UTC obtenido mediante `Clock`.

La frontera HTTP autentica la sesión y construye este contexto. El caso de uso aplica autorización mediante `AuthorizationService`; ninguna ruta o UI puede considerarse una frontera de autorización suficiente. En Fase 2 los tests verifican los códigos estables solicitados mediante autorizadores fake. La autenticación de transporte y las credenciales se implementan antes de exponer la UI operativa.

## Errores y resultado

Los fallos esperados de negocio se devuelven como `Result<T, AppError>`. Los errores inesperados o de infraestructura se registran y se traducen en la frontera. Nunca se devuelve una excepción técnica directamente al renderer.

## Idempotencia

Los comandos que pueden reintentarse después de un corte reciben una clave de idempotencia. `CompleteSale`, `IssueFiscalDocument` y cierres fiscales requieren especial cuidado para no duplicar efectos.

En Fase 4, `CompleteSale` usa `IdempotencyStore`: nodo, operacion y clave identifican la solicitud; un fingerprint distinto produce `IDEMPOTENCY_KEY_CONFLICT`. El resultado completado se guarda en el mismo commit y expira a los 30 dias sin afectar ledger ni auditoria.

## Fase 0

No se implementan casos de uso. Se documentan sus contratos y dependencias para que la Fase 1 no acople la aplicación a los adaptadores.
