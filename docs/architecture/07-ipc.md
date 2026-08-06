# 07. IPC y comunicación

## Decisión principal

Las operaciones de negocio usan la API HTTP de Fastify. Electron IPC queda reservado para capacidades nativas y hardware local.

## Modos de ejecución

### Standalone

Electron inicia Fastify en el proceso `main` o en un proceso hijo controlado, enlazado a `127.0.0.1`. React usa `fetch` contra esa API.

### LAN

El nodo servidor inicia Fastify y SQLite. Cada estación Electron configura la URL del nodo y usa el mismo cliente HTTP. La UI no conoce si el servidor es local o remoto.

## Canales

| Canal | Responsabilidad |
|---|---|
| REST `/api/v1` | comandos y consultas de negocio |
| WebSocket `/ws/events` | eventos de integración para actualizar UI y estaciones |
| Electron IPC | ventanas, almacenamiento seguro, impresión nativa y hardware local |

## Reglas de seguridad Electron

- `contextIsolation: true`.
- `nodeIntegration: false`.
- `sandbox: true` cuando la integración de hardware lo permita.
- `contextBridge` expone una API mínima y tipada.
- El renderer nunca abre SQLite, puertos seriales ni procesos del sistema.
- Tokens y secretos se guardan mediante `safeStorage` o un adaptador equivalente.

## Hardware

El IPC puede transportar comandos a un adaptador local de impresora fiscal, báscula, scanner o impresora térmica. El dominio solo conoce puertos, no canales IPC ni nombres de dispositivos.

## Contratos

Los handlers deben usar envelopes tipados:

```text
{ ok: true, data: ... }
{ ok: false, error: { code, message, details } }
```

Las respuestas HTTP usan `application/problem+json`. Ambos transportes deben mapear los mismos códigos de aplicación.

## Fase 0

No se crean handlers IPC, rutas Fastify ni canales de negocio. Solo se fija el límite para evitar exponer funciones privilegiadas al renderer.
