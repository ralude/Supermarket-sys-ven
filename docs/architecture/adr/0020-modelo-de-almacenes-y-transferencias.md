# ADR-0020: Modelo de almacenes y transferencias de existencia

- Estado: **Aceptado con alcance diferido**
- Fecha: 2026-09-04

## Contexto

`stock_items.product_id` es único y el nodo actual gobierna una sola existencia por producto.
Agregar varios almacenes cambiaría la identidad de un agregado con movimientos persistidos,
además de exigir una regla de despacho, kardex y tránsito.

## Decisión

El MVP conserva **un almacén implícito por nodo**. 9B.08 se marca diferida y no agrega tablas,
migraciones, permisos ni transferencias simuladas. Si una necesidad real exige varios almacenes,
se abrirá una subfase con migración forward-only, ownership, despacho, kardex y recuperación
definidos antes de tocar `StockItem`.

La transferencia entre sucursales o nodos pertenece a Fase 10 por cambiar la autoridad de
escritura. Dos ajustes independientes no sustituyen una transferencia porque perderían la
trazabilidad.

## Invariantes conservadas

- Un movimiento mantiene producto, lote, actor, motivo, referencia e idempotencia.
- Ninguna recepción, venta, conteo o ajuste necesita conocer un almacén inexistente.
- No se hace migración destructiva ni se reinterpretan movimientos históricos.

## Criterio para reabrir el alcance

Un caso de uso real de múltiples ubicaciones, un dueño de la decisión operativa y pruebas de
consistencia multi-almacén. Hasta entonces, el diferimiento es la implementación mínima.
