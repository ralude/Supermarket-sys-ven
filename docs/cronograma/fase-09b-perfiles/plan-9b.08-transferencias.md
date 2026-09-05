# Plan de ejecución 9B.08: Transferencias de existencia

- **Sub-fase:** [9B.08 Transferencias de existencia](./9b.08-transferencias.md)
- **Estado del plan:** Diferido por alcance
- **Decisión:** [ADR-0020](../../architecture/adr/0020-modelo-de-almacenes-y-transferencias.md)
  acepta una existencia implícita por nodo.

## Motivo del diferimiento

`stock_items.product_id` es único y el modelo vigente no representa dos ubicaciones del mismo
producto. Agregar almacenes cambiaría la identidad de un agregado persistido, la regla de
despacho, el kardex, los conteos y la migración. No se justifica para el MVP técnico y no se
simula con dos ajustes independientes porque perdería trazabilidad.

## Alcance vigente

No se agregan tablas, migraciones, permisos, rutas ni pantallas de transferencia. Recepción,
venta, conteo y ajuste siguen operando sobre la existencia única del nodo. La transferencia
entre sucursales o nodos pertenece a Fase 10 por cambiar la autoridad de escritura.

## Criterio para reabrir

Un caso de uso real de múltiples ubicaciones, dueño de la decisión operativa y especificación
aprobada de despacho, tránsito, kardex, ownership, recuperación e idempotencia. Al reabrirse se
actualizarán `04-entidades.md`, `05-agregados.md`, `06-casos-de-uso.md` y la migración
forward-only antes de escribir código.

## Validación actual

- [x] ~~Diferir transferencias y conservar la unicidad vigente.~~
- [x] ~~Dejar visible el destino y el criterio para reabrir la sub-fase.~~
