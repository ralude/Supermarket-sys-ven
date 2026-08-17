# 02. Módulos

Los módulos representan bounded contexts. Cada uno debe tener un lenguaje, datos y casos de uso explícitos. No se permite acceder directamente a tablas de otro módulo.

## Módulos iniciales

| Módulo | Responsabilidad | Dependencias permitidas |
|---|---|---|
| `catalog` | Productos, categorías, unidades, códigos de barra y precios | `currency`, configuración fiscal |
| `currency` | Monedas, tasas, redondeo y métodos de pago | configuración fiscal |
| `cash` | Cajas, turnos, arqueos, ingresos y retiros | `identity`, `currency` |
| `sales` | Carrito, líneas, descuentos, pagos, devoluciones y venta | `catalog`, `currency`, `cash`, `inventory` futuro |
| `fiscal` | Documentos fiscales, jornada, reportes X/Z y dispositivo | `sales`, configuración fiscal |
| `identity` | Usuarios, roles, permisos y autorizaciones | ninguno de negocio |
| `inventory` | Stock, lotes, vencimientos, kardex y mermas | `catalog` |
| `purchasing` | Proveedores, órdenes y recepción | `catalog`, `inventory`, `currency` |
| `customers` | Clientes, RIF/CI y datos fiscales | ninguno de negocio |
| `reports` | Consultas y reportes de lectura | eventos y proyecciones |
| `sync` | Replicación futura y entrega de outbox | infraestructura |

## Alcance del MVP

El MVP funcional posterior a Fase 0 incluirá:

- `catalog`;
- `currency`;
- `cash`;
- `sales`;
- `fiscal` con `FiscalPrinterFake`.

`inventory` será una dependencia explícita del flujo de ventas cuando se implemente stock real. Mientras no exista ese módulo, el MVP no debe simular inventario dentro de `sales`.

`purchasing`, `customers` y los reportes empresariales completos quedan fuera del MVP técnico. Las entradas de inventario de la Fase 6 usan un contrato mínimo de recepción y no implican implementar el agregado `PurchaseOrder`. Los reportes de la Fase 9 se limitan a caja, auditoría, fiscalidad y sincronización ya disponibles.

La evolución posterior está delimitada en [`docs/producto/alcance-entregas.md`](../producto/alcance-entregas.md).

## Reglas entre módulos

- Un módulo expone casos de uso, comandos, queries o eventos; no expone sus tablas.
- Una operación que cruza módulos coordina mediante aplicación y eventos, no mediante llamadas SQL cruzadas.
- Los datos compartidos se copian como snapshot en el contexto consumidor cuando sea necesario para trazabilidad.
- Los nombres de eventos y contratos públicos se versionan.

En la implementación de `catalog`, `Category` y `UnitOfMeasure` son referencias
configurables validadas mediante puertos de aplicación. El agregado `Product`
conserva el código y la escala de la unidad aplicados, y expone un snapshot
estable para `sales`; ningún caso de uso de catálogo accede directamente a sus
tablas.

`identity` mantiene un catálogo de permisos con códigos estables definidos por
el módulo consumidor. Los roles configurables agrupan esos permisos y los
usuarios reciben roles activos y asignables. Autenticación, credenciales y
sesiones no forman parte del dominio de Fase 2.

`inventory` usa `StockItem` como raíz del agregado. El saldo se deriva de
movimientos append-only con la escala del producto; los lotes son opcionales y
se exigen únicamente cuando el artículo declara `tracksBatches`.
