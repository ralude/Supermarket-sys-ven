# Reglas del Proyecto para Agentes de IA

Este archivo es la fuente única de reglas operativas para cualquier agente de código, incluyendo OpenCode, Claude Code, Codex u otras herramientas. Debe leerse antes de inspeccionar para modificar código, documentación técnica o configuración.

## 1. Misión del proyecto

Construir una plataforma empresarial para supermercados en Venezuela con operación standalone y LAN, soporte multi-moneda, trazabilidad comercial, estados fiscales recuperables e integración intercambiable con hardware.

Stack aprobado:

- Electron y React para desktop/UI.
- Fastify para API y servidor local/LAN.
- SQLite y Drizzle para persistencia local.
- TypeScript como lenguaje único de aplicación.
- Vitest para pruebas.

## 2. Estado y disciplina de fases

La Fase 0 define arquitectura, documentación y scaffold. La Fase 1 implementará el MVP funcional (`catalog`, `currency`, `cash`, `sales` y `fiscal-fake`).

Durante la Fase 0 está prohibido implementar ventas, inventario, caja, endpoints de negocio, IPC funcional, tablas de negocio o integración fiscal real.

No adelantes una fase por conveniencia. Si una tarea requiere cambiar el alcance, detén la implementación y registra una decisión o solicita confirmación.

## 3. Lectura obligatoria

Antes de modificar algo:

1. Lee este archivo completo.
2. Lee [`docs/architecture/README.md`](./docs/architecture/README.md).
3. Lee el documento específico de la responsabilidad que vas a tocar.
4. Lee el ADR relacionado si la modificación cambia una decisión existente.

Mapa mínimo:

| Cambio | Lectura obligatoria |
|---|---|
| Dependencias o estructura | `01-capas.md`, ADR-0001 |
| Módulos | `02-modulos.md`, `05-agregados.md` |
| Eventos/outbox | `03-eventos.md`, ADR-0005 |
| Entidades/agregados | `04-entidades.md`, `05-agregados.md` |
| Casos de uso/puertos | `06-casos-de-uso.md` |
| Electron/IPC | `07-ipc.md`, ADR-0002 |
| SQLite/Drizzle/dinero | `08-base-de-datos.md`, ADR-0003 |
| Fiscal/hardware | `09-estados-fiscales.md`, ADR-0004 |
| Logs/auditoría | `10-logs.md`, ADR-0006 |
| Errores | `11-errores.md`, ADR-0006 |
| Pruebas / TDD | ADR-0007 |

## 4. Arquitectura obligatoria

La metodología es DDD táctico + arquitectura hexagonal/Clean Architecture.

```text
apps/*
  -> packages/drivers/*
  -> packages/core/src/application
  -> packages/core/src/domain
  -> packages/shared
```

Reglas estrictas:

- `core/domain` no puede importar `core/application`, `drivers`, Electron, Fastify, Drizzle, SQLite, React ni transportes.
- `core/application` define casos de uso, DTOs y puertos; no implementa adaptadores externos.
- `drivers/*` implementa puertos definidos por `core/application` y aísla dependencias nativas.
- `apps/*` compone dependencias; no contiene reglas de negocio ni SQL.
- `shared` contiene primitivas y contratos verdaderamente transversales; no se convierte en un depósito de lógica de negocio.
- Los paquetes se consumen mediante sus exports públicos; no se importan archivos internos de otro paquete.
- Una integración fiscal nueva debe agregarse como driver sin modificar dominio ni casos de uso.
- El negocio se transporta por HTTP/Fastify; Electron IPC se reserva para capacidades nativas y hardware local.
- Las rutas, handlers IPC y componentes React solo adaptan entrada/salida y delegan en casos de uso.

## 5. Reglas de dominio

- Modela invariantes en entidades, value objects y agregados, no en controladores.
- Usa agregados como fronteras de consistencia.
- Comunica módulos mediante contratos y eventos, nunca mediante acceso a tablas ajenas.
- Los eventos nombran hechos en pasado, son inmutables y sus consumidores son idempotentes.
- Un documento fiscal emitido es inmutable; una corrección usa el mecanismo fiscal correspondiente.
- Los estados fiscales deben ser explícitos, persistibles y recuperables después de reinicios.

## 6. Reglas de datos y dinero

- Nunca uses `float` para dinero, tasas, impuestos o cantidades facturables.
- Almacena dinero como unidades menores enteras más código de moneda.
- Toda conversión entre monedas requiere una tasa explícita, fuente y vigencia.
- Usa UUIDv7 o ULID generados por la aplicación para IDs.
- Almacena tiempo en UTC.
- No abras SQLite desde el renderer ni desde más de un proceso servidor del mismo nodo.
- Toda migración debe ser forward-only, revisable y probada.
- La tasa, IVA, IGTF y cualquier regla fiscal deben ser configurables y auditables; no codifiques valores regulatorios sin validación vigente.

## 7. Reglas de seguridad y observabilidad

- No uses `console.log`; usa el driver de logging.
- Nunca registres PINs, contraseñas, tokens, claves ni números completos de tarjetas.
- Nunca devuelvas stack traces ni detalles internos al cliente.
- Toda operación sensible debe identificar actor, terminal, timestamp y motivo.
- Errores públicos usan códigos estables y mensajes traducibles.
- No expongas Node.js, SQLite, serial ports ni secretos al renderer.

## 8. Flujo obligatorio de trabajo

1. Inspeccionar el código y las reglas aplicables.
2. Definir el cambio mínimo necesario.
3. Escribir la prueba del comportamiento observable (outside-in, ADR-0007).
4. Implementar respetando el grafo de dependencias hasta que la prueba pase.
5. Ejecutar `pnpm test` y `pnpm typecheck`.
6. Actualizar documentación o ADR si cambia una decisión, contrato o estructura.
7. Reportar archivos modificados, validaciones y limitaciones.

No agregues dependencias, abstracciones, compatibilidad hacia atrás o funcionalidades fuera del alcance sin una necesidad concreta y documentada.

## 9. Convenciones

- Identificadores de código en inglés.
- Documentación y mensajes dirigidos al negocio en español.
- Nombres de casos de uso en verbo + sustantivo (`CompleteSale`).
- Errores con códigos estables (`SALE_INVALID_STATE`).
- Cambios pequeños y localizados; evita refactors oportunistas.
- Mantén las fronteras internas de `core` documentadas para permitir extraer subpaquetes en el futuro.

## 10. Verificación mínima

```bash
pnpm install
pnpm test
pnpm typecheck
```

Un cambio no está terminado si falla una de estas verificaciones, salvo que la limitación quede explícitamente reportada.
