# Gate de seguridad antes de UI operativa

- **Estado:** Completado (2026-09-01)
- **Aplica antes de:** Fase 9, sub-fase 9.00
- **Contexto:** [Replanificación de Fase 8 a Fase 9](./replanificacion-fase-08-a-09.md)

## Propósito

Evitar que rutas HTTP y pantallas operativas nazcan sin identidad, sesión y autorización aplicable en casos de uso.

## Prerrequisitos ya modelados

- `User`, `Role`, `Permission` y `AuthorizationService` se definen en la sub-fase 2.06.
- Los comandos sensibles reciben el contexto de ejecución definido en `06-casos-de-uso.md`.
- Persistencia, auditoría e idempotencia están disponibles desde las fases 3 y 4.

## Tareas del gate

- [x] ~~Aprobar la política de autenticación, bloqueo, sesión e identidad del
  nodo en [ADR-0011](../architecture/adr/0011-autenticacion-pin-y-sesiones-locales.md).~~
- [x] ~~Completar autenticación mínima de 11.01.~~
- [x] ~~Enforzar roles y permisos de 11.02 en los casos de uso expuestos.~~
- [x] ~~Completar sesión HTTP, expiración y revocación mínima de 11.03.~~
- [x] ~~Construir `ExecutionContext` únicamente desde una sesión verificada.~~
- [x] ~~Probar acceso permitido, denegado, expirado y revocado.~~

## Criterio de salida

Ningún endpoint de negocio ni pantalla operativa puede ejecutar un efecto sin identidad y autorización verificadas. Cifrado avanzado y hardening final continúan en la Fase 11.

El gate exige además pruebas de cinco fallos concurrentes sin incrementos
perdidos, expiración idle/absoluta, revocación, cambio de autorización,
suplantación rechazada de terminal/nodo y equivalencia pública entre operador
inexistente y PIN incorrecto.

El corte mínimo queda cerrado mediante la migración 13, sesiones opacas,
provisión local del primer administrador y pruebas de contrato HTTP. Esto no
adelanta cifrado avanzado, transporte HTTPS ni hardening final de 11.04–11.05.
