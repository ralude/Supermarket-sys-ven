# @supermarket/server

Aplicacion Fastify para el nodo standalone o LAN.

## Comandos

- `pnpm --filter @supermarket/server dev`: inicia el servidor con watch.
- `pnpm --filter @supermarket/server start`: inicia el servidor en `127.0.0.1:3000`.
- `pnpm --filter @supermarket/server test`: ejecuta las pruebas del servidor.
- `pnpm --filter @supermarket/server typecheck`: verifica TypeScript.

El scaffold solo expone `GET /health`. No contiene rutas de negocio, SQL, WebSocket ni autenticacion.

`SERVER_HOST` y `SERVER_PORT` permiten cambiar el bind y el puerto para desarrollo. El valor por defecto es loopback (`127.0.0.1`) para el modo standalone.
