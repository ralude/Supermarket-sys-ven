# ADR-0003: SQLite, dinero e identificadores

- Estado: Aceptado
- Fecha: 2026-08-05

## Contexto

El sistema debe operar localmente, soportar cortes de conectividad y evitar errores de redondeo con VES, USD, tasas e impuestos.

## Decisión

Usaremos SQLite en el nodo servidor, Drizzle como ORM y `better-sqlite3` como driver inicial. El dinero se almacenará como entero en unidades menores acompañado de código de moneda. Las tasas se almacenarán con escala explícita o decimal textual. Los IDs serán generados por la aplicación usando UUIDv7 o ULID.

## Consecuencias

- No se usará `float` para dinero ni tasas.
- Se puede migrar o replicar sin depender de IDs autoincrementales locales.
- SQLite requiere single-writer y una política clara de backups.
- Las unidades menores y escalas deben definirse por moneda y documentarse.
