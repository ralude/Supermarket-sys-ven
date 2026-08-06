# @supermarket/core

Paquete central del sistema. Contiene dos fronteras internas estrictas:

- `src/domain`: entidades, agregados, value objects, eventos e invariantes.
- `src/application`: casos de uso, DTOs, puertos y orquestación.

## Dependencias permitidas

- `domain` puede depender de `@supermarket/shared`, pero nunca de `application`, `drivers` ni frameworks.
- `application` puede depender de `domain` y `@supermarket/shared`.
- Los adaptadores concretos pertenecen a `packages/drivers/*`.

La separación interna permite extraer `domain` y `application` a paquetes independientes si el crecimiento del sistema lo requiere.

La Fase 0 no implementa funcionalidad de negocio.
