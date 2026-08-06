# @supermarket/driver-db

Driver de conexion para SQLite y Drizzle. Aisla `better-sqlite3` y verifica los pragmas requeridos al abrir una base.

## Uso actual

`openDatabase(path)` devuelve la conexion SQLite, el cliente Drizzle y una funcion `close`. La configuracion aplica y verifica WAL, foreign keys, busy timeout y synchronous NORMAL.

La base `:memory:` se admite para pruebas; SQLite no puede usar WAL en memoria, por lo que esa verificacion se omite solo para ese path.

## Limites de Fase 1

Este paquete no crea tablas de negocio, migraciones, repositorios ni Unit of Work. Esas responsabilidades pertenecen a la Fase 3.

Solo el proceso Fastify/servidor debe abrir el archivo SQLite. El renderer y Electron no acceden directamente a la base.

El uso del driver dentro de un proceso Electron requerira revisar el rebuild de ABI nativa durante el empaquetado standalone. Esta fase ejecuta el driver bajo Node.
