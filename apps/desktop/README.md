# @supermarket/desktop

Aplicacion Electron con renderer React y preload seguro.

## Comandos

- `pnpm --filter @supermarket/desktop dev`: inicia Electron con el renderer React en desarrollo.
- `pnpm --filter @supermarket/desktop build`: compila main, preload y renderer.
- `pnpm --filter @supermarket/desktop start`: abre el resultado compilado; requiere ejecutar `build` antes.
- `pnpm --filter @supermarket/desktop test`: ejecuta el smoke test del renderer sin hardware.

El preload solo expone una informacion diagnostica minima mediante `contextBridge`. El negocio continua transportandose por HTTP/Fastify; no se agregan handlers IPC de negocio en esta fase.
