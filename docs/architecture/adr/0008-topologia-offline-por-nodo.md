# ADR-0008: Topología offline por nodo

- Estado: Aceptado
- Fecha: 2026-08-14

## Contexto

La topología LAN original hacía que las estaciones dependieran de un servidor central, mientras que el cronograma exige completar ventas locales durante una caída de red. Ambos comportamientos no pueden cumplirse con una estación delgada.

## Decisión

Cada terminal POS será un nodo operativo autónomo con Fastify y SQLite local. Un nodo coordinador de tienda recibirá eventos, distribuirá datos de referencia y mantendrá proyecciones consolidadas. Cada SQLite conserva un único proceso escritor.

Las ventas, turnos y documentos fiscales pertenecen a su terminal de origen. Catálogo, configuración, tasas confirmadas e identidad se originan en el coordinador y se distribuyen como datos versionados. El inventario consolidado se resuelve según la política documentada en `12-sincronizacion-y-ownership.md`.

## Consecuencias

- Una terminal puede operar sin LAN y sincronizar después.
- Cada agregado tiene un único nodo dueño; no se aceptan escrituras concurrentes multi-master.
- La estación requiere almacenamiento y ciclo de vida del servidor local también en modo LAN.
- Catálogo, permisos y disponibilidad local pueden estar desactualizados y la UI debe hacerlo visible.
- El stock global no puede garantizarse durante desconexiones sin reservas o restricciones adicionales.
- ADR-0002 se mantiene para la separación HTTP/IPC, pero su topología LAN queda precisada por esta decisión.
