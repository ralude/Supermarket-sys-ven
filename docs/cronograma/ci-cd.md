# CI/CD Local

Mientras el repositorio no tenga una plataforma remota, la verificacion obligatoria se ejecuta mediante `pnpm pipeline`.

## Orden del pipeline

1. Lint (`pnpm lint`).
2. Typecheck (`pnpm typecheck`).
3. Tests (`pnpm test`, unit e integration juntas).

Etapas pendientes (requieren configuracion especifica que no corresponde a la Fase 1):

- Coverage (necesita `@vitest/coverage-v8` + umbrales).
- Empaquetado Electron (necesita `electron-builder` + configuracion).

Cada etapa debe detener el pipeline si falla. No se considera terminado un cambio que no pase el pipeline completo.

## Reglas

- El script debe ser reproducible en Windows y en el entorno de desarrollo documentado.
- Las pruebas de integracion usan SQLite real temporal y se ejecutan como parte de `pnpm test` (proyectos Vitest).
- El empaquetado Electron se habilita cuando exista el scaffold funcional de desktop.
- Un hook local pre-push puede ejecutar `pnpm ci`, pero no sustituye la ejecucion manual del pipeline.
- Si se agrega un remote, se podra trasladar el mismo orden a la plataforma elegida sin cambiar los comandos.
