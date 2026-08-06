# ADR-0007: Outside-In TDD para funcionalidades

- Estado: Aceptado
- Fecha: 2026-08-05

## Contexto

La Fase 0 define la arquitectura y los contratos del sistema, pero no prescribe el orden de trabajo para implementar funcionalidades. La arquitectura permite probar el dominio y la aplicación sin Electron, SQLite ni hardware, y los puertos permiten sustituir dependencias externas por fakes en las pruebas.

## Decisión

Desde la Fase 1 desarrollaremos las funcionalidades de dominio y aplicación mediante Outside-In TDD. Cada caso de uso comenzará con una prueba de comportamiento observable en su frontera de aplicación, usando fakes para sus puertos. Después se implementará el caso de uso y el comportamiento de dominio necesario hasta que la prueba pase. Los adaptadores concretos tendrán pruebas propias contra el contrato del puerto, incluyendo repositorios Drizzle sobre una SQLite temporal cuando corresponda.

No usaremos TDD para diseñar la arquitectura o el scaffold de la Fase 0, ni lo exigiremos como regla general para componentes React puramente presentacionales.

## Consecuencias

- Cada caso de uso nuevo debe tener una prueba de comportamiento antes de su implementación.
- Los puertos de aplicación deben poder sustituirse por fakes o adaptadores de prueba.
- Las reglas de negocio se validan sin depender de Electron, SQLite ni hardware.
- Los adaptadores de infraestructura se verifican de forma independiente contra sus contratos.
- `pnpm test` y `pnpm typecheck` siguen siendo la verificación mínima del proyecto.
