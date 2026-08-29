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
- `CalculateMixedPaymentTotals`

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

En la Fase 2, `ExecutionContext` identifica al actor y
`AuthorizationService` es la frontera estable para autorizar descuentos,
anulaciones y operaciones sensibles de caja. `User`, `Role` y `Permission`
expresan las concesiones sin autenticar el transporte. `RegisterMixedPayment`
recibe un lote atómico, exige tasas explícitas para conversiones y conserva el
snapshot del método y de la tasa utilizada.

### `inventory`

La Fase 2 expone únicamente el agregado puro `StockItem`; no crea casos de uso,
DTO ni repositorios. Recepciones operativas, consumo de `SaleCompleted`, mermas,
ajustes autorizados y consultas de kardex se implementan en la Fase 6.

### `fiscal`

- `IssueFiscalDocument`
- `PrintXReport`
- `PrintZReport`
- `ReconcileFiscalState`

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
