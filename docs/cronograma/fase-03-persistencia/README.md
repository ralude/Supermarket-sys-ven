# Fase 3: Persistencia

- **Estado:** Pendiente
- **Indice:** [Cronograma](../README.md)

## Proposito

Persistir agregados con SQLite y Drizzle mediante transacciones explicitas.

## Sub-fases

- [3.01 Conexion SQLite](./3.01-conexion-sqlite.md)
- [3.02 Migraciones](./3.02-migraciones.md)
- [3.03 Repositorios](./3.03-repositorios.md)
- [3.04 Integration tests](./3.04-integration-tests.md)

## Regla principal

Toda escritura sigue `BEGIN -> Guardar -> COMMIT`. Nunca se inserta o actualiza fuera de una transaccion.

## Criterio de salida

Los repositorios y la unidad de trabajo pasan pruebas con SQLite real y migraciones forward-only.
