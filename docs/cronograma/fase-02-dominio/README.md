# Fase 2: Codigo de negocio

- **Estado:** En progreso
- **Indice:** [Cronograma](../README.md)

## Proposito

Crear los modulos de dominio y aplicacion con TDD, sin persistencia y sin impresora.

## Sub-fases

- [~~2.01 Primitivas monetarias~~](./2.01-primitivas-monetarias.md)
- [~~2.02 Moneda~~](./2.02-moneda.md)
- [~~2.03 Producto~~](./2.03-producto.md)
- [~~2.04 Venta~~](./2.04-venta.md)
- [~~2.05 Caja~~](./2.05-caja.md)
- [~~2.06 Usuario~~](./2.06-usuario.md)
- [2.07 Inventario](./2.07-inventario.md)

## Restricciones

Los agregados deben ser puros. No usar SQLite, Drizzle, HTTP, Electron, hardware ni impresora fiscal.

## Criterio de salida

Los flujos definidos en cada sub-fase tienen pruebas unitarias verdes y no dependen de adaptadores externos.
