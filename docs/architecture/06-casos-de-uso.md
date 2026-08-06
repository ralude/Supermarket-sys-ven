# 06. Casos de uso

Los casos de uso son la API de aplicación. Orquestan una intención del usuario o de un proceso, pero no contienen detalles de HTTP, Electron, SQL ni UI.

## Flujo estándar

```text
DTO de entrada
  -> validación de forma
  -> autenticación/autorización
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

### `currency`

- `UpdateExchangeRate`
- `GetCurrentExchangeRate`
- `CalculateMixedPaymentTotals`

### `cash`

- `OpenShift`
- `RegisterCashMovement`
- `CloseShift`

### `sales`

- `StartSale`
- `AddItemToSale`
- `RemoveItemFromSale`
- `RegisterMixedPayment`
- `CompleteSale`
- `VoidSale`

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

## Errores y resultado

Los fallos esperados de negocio se devuelven como `Result<T, AppError>`. Los errores inesperados o de infraestructura se registran y se traducen en la frontera. Nunca se devuelve una excepción técnica directamente al renderer.

## Idempotencia

Los comandos que pueden reintentarse después de un corte reciben una clave de idempotencia. `CompleteSale`, `IssueFiscalDocument` y cierres fiscales requieren especial cuidado para no duplicar efectos.

## Fase 0

No se implementan casos de uso. Se documentan sus contratos y dependencias para que la Fase 1 no acople la aplicación a los adaptadores.
