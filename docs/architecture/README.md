# Arquitectura del Sistema

## Propósito

Este directorio contiene las decisiones arquitectónicas para el sistema de supermercados orientado al mercado empresarial venezolano.

La arquitectura prioriza:

- operación confiable con conectividad intermitente;
- ejecución standalone y evolución a una red LAN multi-terminal;
- trazabilidad de operaciones comerciales y fiscales;
- dinero y tasas de cambio sin errores de precisión;
- integración intercambiable con hardware fiscal;
- separación estricta entre dominio, aplicación, infraestructura y presentación.

## Alcance de la Fase 0

Esta fase define contratos, límites y decisiones. No implementa ventas, inventario, caja, facturación ni integración real con hardware. El scaffold y las dependencias de infraestructura pertenecen a la Fase 1 del [cronograma del proyecto](../cronograma/README.md).

Incluye:

- documentación arquitectónica separada por tema;
- registros de decisiones arquitectónicas (ADR);
- contratos y límites que guían las fases posteriores.

## Documentos

| Orden | Documento | Contenido |
|---:|---|---|
| 00 | [Contexto y alcance](./00-contexto-y-alcance.md) | Objetivos, restricciones y principios |
| 01 | [Capas](./01-capas.md) | Clean Architecture y reglas de dependencia |
| 02 | [Módulos](./02-modulos.md) | Bounded contexts y límites iniciales |
| 03 | [Eventos](./03-eventos.md) | Eventos de dominio, integración y outbox |
| 04 | [Entidades](./04-entidades.md) | Entidades y value objects previstos |
| 05 | [Agregados](./05-agregados.md) | Fronteras de consistencia e invariantes |
| 06 | [Casos de uso](./06-casos-de-uso.md) | Contratos de aplicación y catálogo del MVP |
| 07 | [IPC](./07-ipc.md) | Comunicación Electron, Fastify y hardware |
| 08 | [Base de datos](./08-base-de-datos.md) | SQLite, Drizzle y convenciones de persistencia |
| 09 | [Estados fiscales](./09-estados-fiscales.md) | Máquinas de estado y recuperación ante fallos |
| 10 | [Logs](./10-logs.md) | Logs técnicos, auditoría y redacción |
| 11 | [Errores](./11-errores.md) | Errores tipados, códigos y fronteras de transporte |
| 12 | [Sincronización y ownership](./12-sincronizacion-y-ownership.md) | Nodos autónomos, autoridad de escritura y conflictos |

## ADRs

- [ADR-0001: DDD táctico y arquitectura hexagonal](./adr/0001-ddd-arquitectura-hexagonal.md)
- [ADR-0002: Transporte de negocio e IPC](./adr/0002-transporte-negocio-ipc.md)
- [ADR-0003: SQLite, dinero e identificadores](./adr/0003-sqlite-dinero-identificadores.md)
- [ADR-0004: Estados fiscales persistidos](./adr/0004-estados-fiscales-persistidos.md)
- [ADR-0005: Eventos y outbox](./adr/0005-eventos-outbox.md)
- [ADR-0006: Errores, logs y auditoría](./adr/0006-errores-logs-auditoria.md)
- [ADR-0007: Outside-In TDD para funcionalidades](./adr/0007-outside-in-tdd.md)
- [ADR-0008: Topología offline por nodo](./adr/0008-topologia-offline-por-nodo.md)
- [ADR-0009: Estado relacional, ledger y outbox](./adr/0009-estado-relacional-ledger-outbox.md)

## Alcance del producto

Los niveles MVP técnico, piloto, producción soportada y plataforma empresarial se distinguen en [Alcance por nivel de entrega](../producto/alcance-entregas.md).

## Estado

El estado de ejecución no se duplica aquí. Consulta el [cronograma maestro](../cronograma/README.md), que contiene la fase y sub-fase actual.

## Mapeo del monorepo

| Ruta | Responsabilidad |
|---|---|
| `apps/desktop` | Electron, React, preload y supervisión del servidor local de la estación |
| `apps/server` | Fastify, HTTP, WebSocket y composición tanto de terminales como del coordinador |
| `packages/shared` | primitivas y contratos transversales sin lógica de negocio |
| `packages/core/src/domain` | dominio puro: entidades, agregados, eventos e invariantes |
| `packages/core/src/application` | casos de uso, DTOs, autorización y puertos |
| `packages/drivers/db` | SQLite por nodo, Drizzle, repositorios, migraciones, ledger y outbox |
| `packages/drivers/fiscal` | adaptadores de impresoras fiscales |
| `packages/drivers/hardware` | periféricos y hardware local |
| `packages/drivers/logging` | logs técnicos y auditoría |

La estructura interna de `core` permite extraer `domain` y `application` a paquetes separados si el crecimiento lo justifica. Los drivers están separados por integración para aislar dependencias nativas y permitir reemplazos independientes.

Las obligaciones fiscales concretas deben validarse con un proveedor fiscal certificado y asesoría tributaria vigente antes de producción. La arquitectura no sustituye la certificación ni la interpretación legal.
