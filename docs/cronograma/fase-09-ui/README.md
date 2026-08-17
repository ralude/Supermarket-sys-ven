# Fase 9: UI

- **Estado:** Pendiente
- **Indice:** [Cronograma](../README.md)

## Proposito

Construir la interfaz React y su integracion con el negocio a traves de HTTP.

## Sub-fases

- [9.00 API HTTP y composicion](./9.00-api-http.md)
- [9.01 Base React](./9.01-base-react.md)
- [9.02 Pantalla de venta](./9.02-pantalla-venta.md)
- [9.03 Pantalla de caja](./9.03-pantalla-caja.md)
- [9.04 Pantalla de catalogo](./9.04-pantalla-catalogo.md)
- [9.05 Pantalla de inventario](./9.05-pantalla-inventario.md)
- [9.06 Reportes y cierres](./9.06-pantalla-reportes.md)
- [9.07 Tasas de cambio](./9.07-tasas-de-cambio.md)

## Restriccion

El renderer no accede directamente a Node.js, SQLite, serial ports ni secretos.

Antes de 9.00 debe completarse el [gate de seguridad antes de UI operativa](../gate-seguridad-pre-ui.md). Las pantallas no crean endpoints ad hoc; consumen los contratos publicados en 9.00.

## Criterio de salida

Los flujos principales se pueden operar desde la UI y tienen pruebas E2E.
