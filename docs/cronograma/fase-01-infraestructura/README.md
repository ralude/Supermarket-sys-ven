# Fase 1: Infraestructura

- **Estado:** ~~Completada~~
- **Indice:** [Cronograma](../README.md)

## Proposito

Completar el monorepo ejecutable y sus herramientas base sin implementar reglas de negocio.

## Sub-fases

- [~~1.01 Monorepo~~](./1.01-monorepo.md)
- [~~1.02 TypeScript~~](./1.02-typescript.md)
- [~~1.03 Vitest~~](./1.03-vitest.md)
- [~~1.04 Primitivas shared~~](./1.04-primitivas-shared.md)
- [~~1.05 Electron y React~~](./1.05-electron-react.md)
- [~~1.06 Fastify~~](./1.06-fastify.md)
- [~~1.07 SQLite y Drizzle~~](./1.07-sqlite-drizzle.md)
- [~~1.08 Linter~~](./1.08-linter.md)

## Restricciones

No crear tablas de negocio, endpoints de negocio, IPC funcional ni agregados ejecutables en esta fase.

## Criterio de salida

Los paquetes declarados tienen dependencias y smoke tests mínimos, `pnpm test`, `pnpm typecheck` y `pnpm lint` funcionan.
