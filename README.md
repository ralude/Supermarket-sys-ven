# Cullen

Plataforma empresarial para supermercados en Venezuela, basada en Electron, React, Fastify, SQLite, Drizzle, TypeScript y Vitest.

El sistema está diseñado para operar standalone o en LAN mediante terminales autónomas sincronizadas, con soporte multi-moneda, trazabilidad comercial, estados fiscales recuperables e integraciones intercambiables con hardware.

## Estado actual

Las fases 0 a 7 estan completadas. La Fase 8 esta suspendida por dependencia externa; el MVP
continua en modo fiscal simulado y no certificado. La integracion real comienza por la sub-fase
8.00 antes de agregar `SerialPort` al workspace de produccion; el detalle del avance esta en
[`docs/cronograma/README.md`](./docs/cronograma/README.md).

La documentación arquitectónica está organizada por responsabilidad en [`docs/architecture/README.md`](./docs/architecture/README.md).
El alcance del MVP, piloto, producción y plataforma empresarial se separa en [`docs/producto/alcance-entregas.md`](./docs/producto/alcance-entregas.md).
Este proyecto se distribuye bajo la [Licencia Apache 2.0](./LICENSE).

## Estructura del monorepo

```text
apps/
  desktop/                    Electron + React
  server/                     Fastify standalone/LAN
packages/
  shared/                     primitivas y contratos transversales
  core/
    src/domain/               entidades, agregados, VOs y eventos
    src/application/          casos de uso, DTOs y puertos
  drivers/
    db/                       SQLite + Drizzle
    fiscal/                   impresoras fiscales y fake
    hardware/                 scanner, báscula e impresión local
    logging/                  logs técnicos y auditoría
docs/architecture/            arquitectura y ADRs
```

## Metodología

El proyecto utiliza DDD táctico y arquitectura hexagonal/Clean Architecture.

- `core/domain` contiene reglas de negocio puras.
- `core/application` contiene casos de uso y puertos.
- `drivers/*` implementa adaptadores externos.
- `apps/*` compone dependencias y adapta transportes.
- `shared` contiene únicamente primitivas verdaderamente transversales.

El grafo de dependencias permitido es:

```text
apps/* -> packages/drivers/* -> packages/core/src/application -> packages/core/src/domain -> packages/shared
```

Las reglas operativas obligatorias y agente-agnósticas están en [`AGENTS.md`](./AGENTS.md). Ese archivo es la fuente única para OpenCode, Claude Code, Codex y cualquier otro agente de IA. Los puentes [`CLAUDE.md`](./CLAUDE.md) y [`CODEX.md`](./CODEX.md) apuntan al mismo documento.

## Comandos

```bash
pnpm install
pnpm test
pnpm typecheck
```

## Alcance de la Fase 0

La Fase 0 define la arquitectura. Las dependencias y smoke tests de infraestructura se completan en la Fase 1; el código de negocio inicia en la Fase 2, la persistencia en la Fase 3 y la fiscalidad fake en la Fase 7. El cronograma mantiene el detalle y el estado de cada sub-fase.
