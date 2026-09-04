# Plan de ejecución 9.01: Base React

- **Sub-fase:** [9.01 Base React](./9.01-base-react.md)
- **Estado del plan:** Completado
- **Prerrequisito:** [9.00 API HTTP y composición](./9.00-api-http.md)
- **Disciplina visual:** Ponytail `full`, limitada a presentación

## Resultado esperado

La aplicación de escritorio arranca con una frontera HTTP única, recupera la
sesión mediante cookie segura, muestra acceso cuando no existe sesión y ofrece
un shell navegable cuando la sesión es válida. El renderer no conoce tokens,
Node.js, SQLite, Electron ni reglas de negocio.

## Decisiones mínimas

- Reutilizar React, HTML semántico y CSS existentes; no agregar router,
  biblioteca visual, estado global ni design system.
- Resolver la navegación inicial con enlaces hash y `hashchange`. Las pantallas
  operativas siguen perteneciendo a 9.02–9.07.
- Mantener un cliente `fetch` pequeño con `credentials: "include"`; los errores
  públicos se representan con el envelope `ProblemDetails` compartido.
- Recuperar primero `GET /api/v1/auth/session`. Una respuesta `401` muestra el
  formulario de acceso; otros fallos muestran un estado recuperable.
- Después del acceso o de recuperar sesión, consultar capabilities y mostrar de
  forma permanente `SIMULACIÓN`. X/Z no se ejecutan desde esta sub-fase.
- Mantener `platform` como única capacidad nativa detrás de preload.

## Secuencia outside-in

1. Probar el cliente HTTP: cookie incluida, JSON exitoso, `204` y
   `application/problem+json` estable.
2. Probar los estados observables del renderer: carga, acceso, error recuperable
   y shell autenticado.
3. Implementar la frontera HTTP y el controlador mínimo de sesión.
4. Implementar el shell y su navegación hash.
5. Aplicar la presentación visual con CSS nativo y verificar el build Electron.

## Criterios de aceptación

- [x] ~~El arranque distingue carga, sesión ausente, fallo de red y sesión
  válida.~~
- [x] ~~El formulario usa controles nativos, no conserva ni registra el PIN y
  muestra errores públicos sin detalles internos.~~
- [x] ~~Todas las solicitudes incluyen cookies y ningún token llega al
  renderer.~~
- [x] ~~El shell muestra actor, estado del servidor, plataforma y modo fiscal
  `SIMULACIÓN` con navegación accesible por teclado.~~
- [x] ~~Las rutas futuras solo muestran contexto de la sub-fase correspondiente;
  no simulan datos ni operaciones todavía inexistentes.~~
- [x] ~~Preload sigue siendo la única frontera de capacidades nativas.~~
- [x] ~~Pruebas, lint, typecheck y build de escritorio quedan verdes.~~

## Fuera de alcance

- Flujos de venta, caja, catálogo, inventario, reportes o tasas.
- Router de terceros, componentes genéricos o sistema de temas.
- WebSocket, sincronización y hardware fiscal real.
