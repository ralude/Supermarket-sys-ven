# @supermarket/driver-db

Driver de persistencia para SQLite y Drizzle. Aislará `better-sqlite3`, pragmas, migraciones, repositorios, Unit of Work y outbox.

No debe contener reglas de negocio. Implementará puertos definidos por `@supermarket/core`.
