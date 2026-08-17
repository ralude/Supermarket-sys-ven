# Gate de seguridad antes de UI operativa

- **Estado:** Pendiente
- **Aplica antes de:** Fase 9, sub-fase 9.00

## Propósito

Evitar que rutas HTTP y pantallas operativas nazcan sin identidad, sesión y autorización aplicable en casos de uso.

## Prerrequisitos ya modelados

- `User`, `Role`, `Permission` y `AuthorizationService` se definen en la sub-fase 2.06.
- Los comandos sensibles reciben el contexto de ejecución definido en `06-casos-de-uso.md`.
- Persistencia, auditoría e idempotencia están disponibles desde las fases 3 y 4.

## Tareas del gate

- [ ] Completar autenticación mínima de 11.01.
- [ ] Enforzar roles y permisos de 11.02 en los casos de uso expuestos.
- [ ] Completar sesión HTTP, expiración y revocación mínima de 11.03.
- [ ] Construir `ActorContext` únicamente desde una sesión verificada.
- [ ] Probar acceso permitido, denegado, expirado y revocado.

## Criterio de salida

Ningún endpoint de negocio ni pantalla operativa puede ejecutar un efecto sin identidad y autorización verificadas. Cifrado avanzado y hardening final continúan en la Fase 11.
