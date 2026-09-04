# Plan de ejecución 9B.01: Reestructuración del renderer

- **Sub-fase:** [9B.01 Reestructuración del renderer](./9b.01-reestructuracion-renderer.md)
- **Estado del plan:** Ejecutado; alcance del indicador de conexión ajustado (ver sub-fase)
- **Prerrequisito:** [9B.00 Permisos efectivos en la sesión](./9b.00-permisos-en-sesion.md)
- **Disciplina visual:** Ponytail `full`, limitada a presentación
- **Modo fiscal permitido:** `SIMULACION` mediante `FiscalPrinterFake`

## Resultado esperado

Cada pantalla operativa vive en su propio módulo y las primitivas compartidas en uno solo, de
modo que las vistas por perfil puedan componerse sin duplicar código. El indicador de
conexión refleja el estado real del nodo y la anulación confirma dentro de la pantalla. Salvo
esos dos comportamientos, nada observable cambia.

## Línea base comprobada

- `operation-screens.tsx` concentra las seis pantallas operativas en 561 líneas, con el JSX de
  cada pantalla escrito en una sola línea.
- Las primitivas introducidas en 9.08 ya están extraídas dentro de ese mismo archivo:
  `ActionButton`, `Feedback`, `ScreenNote`, `EmptyState`, `ScreenErrorBoundary` (en `App.tsx`),
  `money` y `saleCompletionBlocker`.
- Cuatro archivos de prueba consumen esos exports. `reports-screen.test.tsx` afirma marcado
  exacto de botones, incluido el orden de atributos, de modo que `ActionButton` debe seguir
  emitiendo `className` antes de las props restantes.
- `routeScreen` traduce el identificador de ruta a la pantalla correspondiente.
- El indicador "Servidor conectado" de la barra superior es marcado fijo: no deriva de
  ninguna lectura.
- La anulación de venta usa `window.confirm`, que bloquea el proceso del renderer.
- El nodo publica una ruta de salud que hoy el escritorio no consume.
- Vitest corre con entorno `node`; el renderer se prueba por SSR con `renderToStaticMarkup` y
  no hay `jsdom` en el monorepo.

## Decisiones de frontera

### Estructura

Una pantalla por módulo bajo un directorio de pantallas, y las primitivas compartidas en un
módulo propio. `operation-screens.tsx` no sobrevive como segunda fuente: o desaparece con las
pruebas actualizadas en el mismo cambio, o queda como fachada de reexportación sin lógica. No
se deja el archivo con la mitad de las pantallas dentro.

No se introduce router, estado global, biblioteca visual ni design system. La navegación hash
y el CSS nativo actuales se conservan tal cual.

### Estado de conexión

El indicador deriva de la lectura de salud del nodo y distingue tres estados observables:
comprobando, conectado y desconectado. Un fallo de esa lectura se presenta como desconectado,
nunca como error de pantalla ni como detalle interno.

La consulta ocurre al montar el shell y después de que una acción falle por transporte. No se
introduce sondeo periódico: un POS de una sola estación no necesita interrogar a su propio
nodo en un temporizador, y hacerlo gastaría el nodo sin agregar información que la siguiente
acción no revele.

### Confirmación de la anulación

La anulación confirma dentro de la pantalla, en el mismo lugar donde ya se escribe el motivo,
que pasa a formar parte de la confirmación. No queda ninguna llamada a `window.confirm`,
`alert` o `prompt` en el renderer: bloquean el proceso y no son accesibles.

## Decisiones requeridas antes de implementar

Ninguna. Esta sub-fase reorganiza código propio y corrige dos comportamientos ya
identificados en la auditoría de 9.08; no toca contratos, dominio ni reglas de negocio.

## Secuencia outside-in

1. Ejecutar la suite actual y fijarla como red de seguridad. Ninguna aserción existente se
   relaja ni se elimina para acomodar la división.
2. Probar los tres estados observables del indicador de conexión.
3. Probar que la anulación confirma sin diálogo nativo y que sin motivo no se habilita.
4. Mover pantallas y primitivas a sus módulos, actualizando importaciones y pruebas en el
   mismo cambio.
5. Implementar el estado de conexión y la confirmación hasta que las pruebas nuevas pasen.
6. Verificar pruebas, typecheck, lint y build de escritorio.

## Criterios de aceptación

- [ ] Cada pantalla operativa vive en su propio módulo y las primitivas compartidas en uno
  solo, sin que `operation-screens.tsx` quede como segunda fuente.
- [ ] Ninguna aserción existente se relajó ni se eliminó para acomodar la división.
- [ ] El indicador de conexión distingue comprobando, conectado y desconectado, y deriva de la
  lectura de salud del nodo.
- [ ] Un fallo de esa lectura se presenta como desconectado, sin detalle interno ni estado de
  error de pantalla.
- [ ] No queda ninguna llamada a `window.confirm`, `alert` o `prompt` en el renderer.
- [ ] La anulación sigue exigiendo motivo y sigue quedando auditada.
- [ ] No se agregó router, estado global, design system ni dependencia nueva.
- [ ] Fuera de conexión y confirmación, el comportamiento observable no cambió.
- [ ] `pnpm test`, `pnpm typecheck`, `pnpm lint` y el build de escritorio quedan verdes.

## Fuera de alcance

- Selectores de datos maestros y unificación del dinero: pertenecen a 9B.02.
- Composición de las vistas por perfil: pertenece a 9B.14 en adelante.
- Adoptar un entorno de pruebas con DOM. Si la cobertura de interacción lo justifica, es una
  decisión propia y documentada, no un efecto colateral de esta reorganización.
- El origen de `/api` en un empaquetado real, reportado como brecha en 9.08.
