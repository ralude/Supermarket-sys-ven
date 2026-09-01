# 07. IPC y comunicación

## Decisión principal

Las operaciones de negocio usan la API HTTP de Fastify. Electron IPC queda reservado para capacidades nativas y hardware local.

## Modos de ejecución

### Standalone

Electron inicia Fastify en el proceso `main` o en un proceso hijo controlado, enlazado a `127.0.0.1`. React usa `fetch` contra esa API.

### LAN

Cada estación Electron inicia o supervisa su Fastify local y usa su SQLite local. React consume la API por loopback igual que en standalone. Un nodo coordinador de tienda expone endpoints técnicos de sincronización y distribución de datos de referencia, pero no sustituye al servidor local de la caja.

La UI distingue conectividad y sincronización, pero los componentes no deciden ownership ni conflictos. Esas políticas pertenecen a aplicación e infraestructura y están documentadas en [12. Sincronización y ownership](./12-sincronizacion-y-ownership.md).

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

Para la integración fiscal seleccionada en el corte 8.00, `apps/server`
conserva el ownership lógico y supervisa un proceso hijo dedicado que posee el
binding o gateway nativo. Electron puede supervisar el servidor, pero renderer,
preload, handlers IPC y rutas Fastify no abren el dispositivo. Terminar ese
proceso hijo es el mecanismo previsto de hard recovery; un reemplazo solo nace
después de verificar la salida del anterior y la liberación del recurso.

## Contratos

Los handlers deben usar envelopes tipados:

```text
{ ok: true, data: ... }
{ ok: false, error: { code, message, details } }
```

Las respuestas HTTP usan `application/problem+json`. Ambos transportes deben mapear los mismos códigos de aplicación.

## Fase 0

No se crean handlers IPC, rutas Fastify ni canales de negocio. Solo se fija el límite para evitar exponer funciones privilegiadas al renderer.
