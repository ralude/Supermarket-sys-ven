# Cronograma del Proyecto

Este directorio es la fuente única de verdad para el avance por fases. Cada fase tiene un README explicativo y un archivo independiente por sub-fase.

## Estado actual

| Fase | Nombre | Estado |
|---:|---|---|
| 0 | Arquitectura | ~~Completada~~ |
| 1 | Infraestructura | ~~Completada~~ |
| 2 | Codigo de negocio | En progreso: sub-fase 2.01 |
| 3 | Persistencia | Pendiente |
| 4 | Event store y auditoria | Pendiente |
| 5 | Caja operativa | Pendiente |
| 6 | Inventario operativo | Pendiente |
| 7 | Driver fiscal fake | Pendiente |
| 8 | Integracion serial | Pendiente |
| 9 | UI | Pendiente |
| 10 | Sincronizacion | Pendiente |
| 11 | Seguridad | Pendiente |
| 12 | Optimizacion | Pendiente |

**Fase actual:** Fase 2 - Codigo de negocio  
**Sub-fase actual:** 2.01 - Primitivas monetarias

## Fases

- [~~Fase 0 - Arquitectura~~](./fase-00-arquitectura/README.md)
- [~~Fase 1 - Infraestructura~~](./fase-01-infraestructura/README.md)
- [Fase 2 - Codigo de negocio](./fase-02-dominio/README.md)
- [Fase 3 - Persistencia](./fase-03-persistencia/README.md)
- [Fase 4 - Event store](./fase-04-event-store/README.md)
- [Fase 5 - Caja](./fase-05-caja/README.md)
- [Fase 6 - Inventario](./fase-06-inventario/README.md)
- [Fase 7 - Driver fiscal fake](./fase-07-driver-fiscal-fake/README.md)
- [Fase 8 - Integracion serial](./fase-08-integracion-serial/README.md)
- [Fase 9 - UI](./fase-09-ui/README.md)
- [Fase 10 - Sincronizacion](./fase-10-sincronizacion/README.md)
- [Fase 11 - Seguridad](./fase-11-seguridad/README.md)
- [Fase 12 - Optimizacion](./fase-12-optimizacion/README.md)

## Reglas de seguimiento

1. Toda tarea terminada se marca como `- [x] ~~tarea~~` en su archivo de sub-fase.
2. Cuando todas las tareas de una sub-fase terminan, se marca su estado como `Completada` y se tacha el enlace en el README de la fase.
3. Cuando todas las sub-fases terminan, se tacha la fase en este índice y se avanza la fase actual.
4. Cada cambio de código o configuración debe indicar la fase y sub-fase que modifica.
5. No se trabaja en una fase futura mientras la fase actual tenga tareas abiertas, salvo una decisión documentada.
6. Las tareas completadas se conservan tachadas; no se eliminan del historial del cronograma.

## Adaptaciones aprobadas

- `currency` se incluye en la Fase 2 porque las ventas requieren moneda, tasas y pagos mixtos.
- `identity` se divide: el modelo `User`/`Role`/`Permission` se crea en la Fase 2; autenticacion, JWT y cifrado quedan en la Fase 11.
- `inventory` se divide: el dominio de movimientos se crea en la Fase 2; su flujo operativo y persistencia quedan en la Fase 6.
- La Fase 2 no imprime ni persiste; la persistencia comienza en la Fase 3 y el driver fiscal fake en la Fase 7.
- CI/CD se ejecuta inicialmente como scripts locales mediante `pnpm ci`, sin asumir una plataforma remota.
- La Fase 1 se registra con su estado real: el monorepo y las herramientas base existen, pero Electron, React, Fastify, SQLite, Drizzle y ESLint quedan abiertos.

## Documentos transversales

- [Estrategia de testing](./testing.md)
- [CI/CD local](./ci-cd.md)
