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

## Reglas entre módulos

- Un módulo expone casos de uso, comandos, queries o eventos; no expone sus tablas.
- Una operación que cruza módulos coordina mediante aplicación y eventos, no mediante llamadas SQL cruzadas.
- Los datos compartidos se copian como snapshot en el contexto consumidor cuando sea necesario para trazabilidad.
- Los nombres de eventos y contratos públicos se versionan.
