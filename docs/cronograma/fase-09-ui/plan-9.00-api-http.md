# Plan de ejecución 9.00: API HTTP y composición

- **Sub-fase:** [9.00 API HTTP y composición](./9.00-api-http.md)
- **Estado del plan:** En ejecución; gate de seguridad pre-UI completado
- **Prerrequisito obligatorio:**
  [Gate de seguridad antes de UI operativa](../gate-seguridad-pre-ui.md)
- **Modo fiscal permitido:** `SIMULACION` mediante `FiscalPrinterFake`

## Resultado esperado

Entregar una API `/api/v1` autenticada y versionada que componga los casos de
uso existentes, valide cada entrada en la frontera, construya un
`ExecutionContext` confiable y devuelva contratos estables para React. Las
rutas solo adaptan HTTP; no contienen negocio, SQL, decisiones de autorización
ni detalles de drivers.

## Línea base comprobada

- `apps/server` solo expone `GET /health` y todavía no depende de `core` ni de
  los drivers del proyecto.
- Los casos de uso de catálogo, moneda, ventas, caja, inventario y fiscalidad ya
  existen y se exportan por la superficie pública de `@supermarket/core`.
- Los repositorios SQLite, `SqliteUnitOfWork`, ledger, outbox, auditoría e
  idempotencia ya tienen adaptadores públicos en `@supermarket/driver-db`.
- `FiscalPrinterFake` es el único adaptador fiscal habilitado.
- `ExecutionContext` y `AuthorizationService` existen como contratos, pero no
  hay persistencia de identidad, credenciales o sesiones en el esquema actual.
- Todavía no existen adaptadores de producción para `Clock`, `IdGenerator` y
  autorización, ni una implementación útil de `packages/drivers/logging`.
- Varias consultas requeridas por 9.02–9.07 no tienen todavía un caso de uso o
  puerto de lectura: venta abierta, turno actual, listado e historial de
  productos, consultas de auditoría, estado fiscal para reportes, sincronización
  pendiente e historial de tasas.

## Bloqueos que no pertenecen a 9.00

Antes de escribir una ruta de negocio deben quedar aprobados e implementados en
el gate de seguridad:

- política de login o PIN, credenciales y bloqueo por intentos;
- persistencia de usuarios, roles, permisos y credenciales;
- tipo de sesión, expiración, renovación, revocación y protección contra
  replay;
- fuente confiable de `actorId` y permisos;
- fuente confiable de `terminalId` y `originNodeId`;
- pruebas de sesión válida, ausente, expirada y revocada.

9.00 consume esos contratos. No crea un usuario fijo, un bypass para loopback,
roles recibidos del cliente ni autenticación temporal dentro de las rutas.

## Decisiones de frontera para 9.00

### Composición y ciclo de vida

- Convertir `buildApp()` en una factory con dependencias explícitas para poder
  probar la frontera sin variables globales.
- Mantener la apertura, migración y cierre de SQLite en el proceso servidor. La
  conexión se abre una vez por nodo y se libera mediante el lifecycle de
  Fastify.
- Instanciar repositorios, `UnitOfWork`, ledger, outbox, auditoría,
  idempotencia, reloj, IDs, autorización y casos de uso en un composition root;
  ningún route plugin construye su propio grafo.
- Consumir únicamente exports públicos de los paquetes.
- No mantener una transacción abierta durante una llamada al fake fiscal.

### Identidad y contexto HTTP

- Toda ruta bajo `/api/v1` que lea o modifique negocio exige una sesión
  verificada, salvo endpoints de autenticación definidos por el gate.
- `actorId`, roles y permisos se derivan de la sesión; el body y los headers del
  cliente no pueden sustituirlos.
- `terminalId` y `originNodeId` provienen de configuración confiable del nodo o
  de la sesión aprobada, no de texto libre enviado por React.
- El servidor valida o genera `correlationId`, lo devuelve al cliente y lo
  conserva en errores y logs.
- Los comandos reintentables exigen `Idempotency-Key`; la clave se asocia con
  nodo, operación y fingerprint según el contrato existente.

### Contratos y validación

- `packages/shared/src/http/v1/` es el dueño único de contratos HTTP. Cada
  módulo publica un archivo `<module>.contracts.ts` con tipos request/response,
  códigos públicos y constantes `HttpContractV1` que contienen `method`,
  `path`, `permission`, política de idempotencia y JSON Schema draft-07 para
  params, query, headers, body y respuestas.
- Los contratos son objetos TypeScript independientes de Fastify. El servidor
  registra esos mismos schemas en Fastify/Ajv; React importa solo tipos y
  constantes públicas. No se agrega Zod, TypeBox, OpenAPI ni codegen en 9.00.
- Las fixtures ejecutables viven junto a su prueba en
  `apps/server/src/routes/<module>/<operation>.contract.test.ts` como casos
  tipados `{ request, expectedStatus, expectedBody }` y se ejecutan con
  `app.inject()`. Fastify valida también la serialización de respuestas para
  detectar divergencia entre handler y schema.
- Validar params, query y body antes de invocar aplicación.
- Dinero, impuestos, tasas y cantidades facturables viajan como enteros con
  moneda o escala explícita; ningún contrato acepta `float` como atajo.
- Fechas y horas se serializan en UTC con un formato único aprobado por el
  contrato.
- Cada ruta delega en un único comando o query de aplicación. Si una pantalla
  necesita una consulta nueva, primero se define el caso de uso y su puerto de
  lectura; la ruta no consulta tablas directamente.

### Errores y observabilidad

- Responder errores con `application/problem+json`, código estable y
  `correlationId`, sin stack, causa, SQL, ruta de archivo ni secreto.
- Mapear validación a `400`, sesión ausente o inválida a `401`, permiso
  insuficiente a `403`, recurso inexistente a `404`, conflictos de estado o
  idempotencia a `409`, indisponibilidad transitoria a `503` y fallos no
  clasificados a `500`.
- Configurar logging estructurado con los campos mínimos de
  `docs/architecture/10-logs.md`. No registrar bodies HTTP, RIF/CI, datos del
  cliente, líneas, pagos ni montos de venta; usar IDs técnicos y una lista
  permitida de metadatos.
- Mantener auditoría de negocio dentro del mismo commit de los casos de uso que
  ya la requieren; un log HTTP no sustituye `audit_log`.

### Modo fiscal simulado

- Componer exclusivamente `FiscalPrinterFake` y exponer una capacidad estable
  que informe `fiscalMode: "SIMULATION"`.
- No aceptar nombres de puerto, modelo, firmware, protocolo, SDK o comandos de
  proveedor por HTTP.
- No describir una confirmación del fake como emisión fiscal legal.
- 9.00 es dueño del guard HTTP de X/Z; no queda diferido. Solo registra las
  rutas cuando la configuración confiable del servidor contiene simultáneamente
  `FISCAL_EXECUTION_TARGET=SIMULATOR` y
  `FISCAL_SIMULATED_REPORT_CONSENT=ALLOW_SIMULATED_X_AND_Z`.
- Cada request X/Z exige además
  `simulationConsent: "ALLOW_SIMULATED_X_AND_Z"`, sesión válida y permiso del
  caso de uso. La respuesta incluye `fiscalMode: "SIMULATION"`.
- Sin ambas opciones de arranque las rutas X/Z no existen y la capability
  publica `simulatedReportsEnabled: false`. Sin consentimiento en request, el
  schema rechaza la entrada antes de invocar aplicación. Pruebas cubren ambas
  puertas y demuestran cero llamada al fake cuando una falta.

## Superficie funcional por cortes verticales

La ruta exacta, método, permiso, schema y códigos de cada operación se fijan en
una fixture contractual antes de implementarla. El orden es:

1. **Fundación HTTP:** health técnico, lifecycle, sesión verificada,
   correlation ID, error mapper, logging y capability fiscal simulada.
2. **Catálogo y moneda:** crear/actualizar producto, actualizar precio, buscar
   por barcode, consultar/actualizar tasa y calcular pagos mixtos.
3. **Ventas:** iniciar, recuperar, modificar, cobrar, completar y anular una
   venta con idempotencia donde corresponda.
4. **Caja:** consultar turno, abrirlo, registrar movimiento y cerrarlo con
   permisos y auditoría.
5. **Inventario:** consultar kardex y ejecutar recepciones o ajustes únicamente
   mediante sus casos de uso autorizados.
6. **Fiscal simulado:** emitir/reconciliar contra el fake, consultar estado y
   definir/probar el guard HTTP de X/Z descrito en este plan.
7. **Lecturas para UI:** cerrar las brechas de queries requeridas por 9.02–9.07
   con casos de uso de lectura, permisos y pruebas, sin SQL en rutas.

Una vertical se termina con su prueba de contrato antes de abrir la siguiente;
no se crea de antemano una capa genérica de controllers, services o
repositories HTTP.

Si una vertical posterior cambia una pieza compartida o el contrato de una
anterior, la tarea afectada se reabre en el mismo cambio, se actualizan schema,
fixtures y mapeo, y se repite toda la suite contractual previa. Un cambio
incompatible exige versionar el contrato o registrar una decisión antes de
modificarlo; no se parchea silenciosamente.

## Secuencia outside-in

1. Cerrar el gate de seguridad y congelar sus contratos públicos.
2. Inventariar cada operación requerida por 9.01–9.07 y registrar las queries
   faltantes, su permiso y su criterio de aceptación.
3. Escribir fixtures de contrato HTTP para la primera vertical: request,
   respuesta, error y headers.
4. Escribir pruebas con `app.inject()` que fallen por el comportamiento
   observable esperado.
5. Implementar schemas, hooks y route plugins mínimos hasta pasar esas pruebas.
6. Componer los casos de uso con SQLite temporal real para las pruebas de
   integración; no simular repositorios.
7. Repetir por vertical y mantener rutas delgadas.
8. Publicar la superficie consumible por 9.01 y actualizar README, cronograma y
   contratos afectados.

## Pruebas de aceptación mínimas

- `/health` continúa siendo técnico y no ejecuta negocio.
- Una ruta de negocio sin sesión o con sesión expirada/revocada responde `401`
  sin ejecutar efectos.
- Una sesión válida sin permiso responde `403` antes de persistir, auditar o
  invocar el fake.
- El cliente no puede suplantar actor, roles, terminal o nodo mediante body,
  query o headers no confiables.
- Entrada inválida responde `400` con `application/problem+json` y código
  estable.
- Conflictos de versión o idempotencia responden `409` sin filtrar detalles
  internos.
- Repetir un comando idempotente con el mismo fingerprint devuelve el resultado
  conservado; reutilizar la clave con otro fingerprint falla.
- Cada respuesta de error y su log comparten `correlationId`; ningún log o body
  contiene PIN, token, cookie, header de autorización, RIF/CI, datos de cliente,
  líneas, pagos, montos de venta ni stack.
- Un flujo representativo de catálogo, venta, caja e inventario atraviesa HTTP,
  aplicación y SQLite temporal real.
- La API informa `SIMULATION`, usa `FiscalPrinterFake` y no expone configuración
  de hardware real.
- X/Z solo están disponibles con las dos opciones exactas de arranque, el
  consentimiento exacto del request, sesión y permiso; cualquier ausencia
  produce cero llamada al fake.
- Cerrar Fastify libera SQLite y permite que otra instancia adquiera el lock
  del nodo.
- ESLint prohíbe en `apps/desktop/src/renderer/**` importar
  `@supermarket/core`, drivers, Node.js, Electron, Drizzle o SQLite. Una prueba
  Vitest de configuración usa `ESLint.lintText()` con filename de renderer y
  snippets negativos para demostrar que cada familia prohibida produce error;
  `pnpm lint` aplica la misma regla al código real.
- Los contratos HTTP compartidos y sus pruebas no serializan credenciales,
  sesión interna ni secretos hacia el renderer.
- `pnpm lint`, `pnpm typecheck` y `pnpm test` quedan verdes.

## Fuera de alcance

- Componentes React, layout, estilos o navegación: comienzan en 9.01 y aplican
  la disciplina visual Ponytail documentada en el README de Fase 9.
- WebSocket y actualización push, hasta que una pantalla demuestre la necesidad
  concreta y se defina su contrato.
- Integración fiscal real, SerialPort, SDK/DLL o detección de hardware.
- Sincronización multi-nodo de Fase 10.
- Cifrado avanzado y hardening final de 11.04–11.05.
- OpenAPI generado, codegen, framework de controllers o contenedor de
  dependencias mientras los contratos explícitos y plugins de Fastify sean
  suficientes.

## Criterio de salida del plan

9.00 puede marcarse completada cuando el gate de seguridad esté cerrado, todas
las operaciones necesarias para las pantallas tengan contrato y caso de uso,
las pruebas de aceptación anteriores pasen, `pnpm lint` verifique el código real
y la prueba de configuración ESLint verifique casos negativos. La ausencia de
secretos se comprueba además sobre las respuestas HTTP de sesión, éxito y error;
no se acepta solo una revisión manual.
