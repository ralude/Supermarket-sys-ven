# ADR-0001: DDD táctico y arquitectura hexagonal

- Estado: Aceptado
- Fecha: 2026-08-05

## Contexto

El sistema combina reglas comerciales, fiscales y de hardware. Si estas reglas se colocan en rutas, componentes React o repositorios, será costoso probarlas y cambiar la topología de despliegue.

## Decisión

Usaremos DDD táctico para modelar entidades, agregados, value objects y eventos. Usaremos arquitectura hexagonal para aislar el dominio mediante puertos y adaptadores.

## Consecuencias

- Las reglas de negocio se prueban sin Electron ni SQLite.
- Fastify, Drizzle e impresoras fiscales quedan reemplazables.
- Habrá más contratos y mapeadores que en una aplicación CRUD directa.
- Las dependencias deben revisarse para evitar fugas de infraestructura al dominio.
