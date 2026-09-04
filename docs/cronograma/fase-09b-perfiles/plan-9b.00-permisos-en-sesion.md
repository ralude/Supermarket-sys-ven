# Plan de ejecución 9B.00: Permisos efectivos en la sesión

- **Sub-fase:** [9B.00 Permisos efectivos en la sesión](./9b.00-permisos-en-sesion.md)
- **Estado del plan:** Ejecutado; ADR-0015 aceptado
- **Prerrequisito:** ninguno; es la entrada de la fase
- **Disciplina visual:** Ponytail `full`, limitada a presentación
- **Modo fiscal permitido:** `SIMULACION` mediante `FiscalPrinterFake`

## Resultado esperado

La sesión entrega los permisos efectivos del operador. El renderer decide qué rutas,
pantallas y botones ofrece cruzando esos permisos con el campo `permission` que cada
contrato HTTP ya declara. Una prueba impide que ese campo se desvíe del permiso que el caso
de uso realmente exige. Ninguna regla de autorización queda escrita dos veces.

## Línea base comprobada

- `SessionPrincipal` ya expone `roleCodes` **y** `permissionCodes`, ambos poblados por
  `loadPrincipal` con un join sobre usuario, roles y permisos activos.
- El mapper `responseFrom` de la ruta de sesión copia solo `actorId`, `displayName`,
  `roleCodes` y las dos expiraciones: descarta `permissionCodes`.
- `SessionResponse` declara su esquema con `additionalProperties: false`, de modo que un
  campo no declarado se elimina al serializar. `currentSessionContract` reutiliza el `200` de
  `loginContract`: un solo cambio cubre acceso y recuperación de sesión.
- `HttpContractV1` declara `permission: string | null`. Dieciséis contratos lo usan, dos con
  alternativa (`cash.movement.income|cash.movement.withdrawal` y
  `inventory.waste.register|inventory.adjust`). Ningún código lee ese campo hoy.
- El renderer ya importa los objetos de contrato en `api-client.ts` y construye cada
  solicitud a partir de `contract.path` y `contract.method`: los permisos declarados ya están
  en su ámbito.
- La autorización real ocurre dentro del caso de uso a través de `AuthorizationService`, en
  dieciocho puntos. HTTP solo autentica con `requirePrincipal`.
- Existen 21 permisos estables en `packages/core/src/application/<módulo>/permissions.ts`,
  agregados en `ADMIN_PERMISSIONS`.
- El renderer nunca lee `roleCodes`; el único campo de sesión consumido es `displayName`.

## Decisiones de frontera

### Autoridad

El servidor sigue siendo la única autoridad. `permissionCodes` es una proyección para
presentación y no relaja ninguna comprobación: el caso de uso vuelve a autorizar en cada
intento. Ocultar una acción nunca sustituye autorizarla, el mismo principio que ADR-0014 ya
fija para el formulario de confirmación de tasa.

### Forma del contrato

`permissionCodes` es un arreglo de cadenas, ordenado y sin duplicados, y pertenece a los
campos obligatorios del `200`: un cliente nunca debe deducir si el campo vino o si el actor
no tiene permisos. Un actor sin permisos recibe un arreglo vacío, no un campo ausente.

No se publica el mapa rol a permiso. El cliente recibe el efecto, nunca la política: quién
otorga qué sigue siendo configuración del servidor.

### Evaluación del permiso declarado

El evaluador vive en `shared`, junto al contrato que interpreta. Resuelve exactamente tres
formas: `null` significa que basta una sesión válida, un código simple exige ese permiso, y
`a|b` se satisface con cualquiera de los dos. No se introducen comodines, jerarquías,
negaciones ni permisos derivados: ninguna de esas formas existe hoy y ADR-0012 declara las
asignaciones configurables, no jerárquicas.

### Deriva entre contrato y caso de uso

El campo `permission` deja de ser documentación. Una prueba recorre los contratos y verifica
que el permiso declarado coincide con la constante que su caso de uso exige, de modo que
agregar un contrato con un permiso equivocado rompa la suite en lugar de producir una
interfaz que ofrece acciones imposibles.

### Presentación

Una ruta cuyo permiso no está concedido no se lista en la navegación y no se resuelve.
Navegar a su hash a mano muestra un estado explicable de acceso no autorizado, no una
pantalla vacía ni un detalle interno.

## Decisiones requeridas antes de implementar

Ninguna decisión de negocio. Las cinco decisiones de frontera anteriores son de ingeniería y
se registran en **ADR-0015** como parte de esta sub-fase, antes de implementar.

## Secuencia outside-in

1. Probar que el acceso y la recuperación de sesión devuelven los permisos efectivos del
   actor, y que un actor sin permisos recibe un arreglo vacío y no un campo ausente.
2. Probar el evaluador del campo `permission` en sus tres formas: nulo, simple y alternativa.
3. Probar que el permiso declarado por cada contrato coincide con el que exige su caso de
   uso.
4. Probar los estados observables del shell con tres sesiones: todos los permisos, ninguno y
   un subconjunto; incluir la navegación directa a una ruta no autorizada.
5. Implementar contrato, mapper, evaluador y derivación de la navegación hasta que las
   pruebas pasen.
6. Redactar ADR-0015, enlazarlo en el índice de arquitectura y actualizar el cronograma.

## Criterios de aceptación

- [ ] La sesión entrega los permisos efectivos del actor, ordenados, sin duplicados y
  presentes aunque el arreglo esté vacío.
- [ ] Ningún permiso llega al renderer por otra vía y no existe un mapa rol a permiso en el
  cliente.
- [ ] La navegación, las pantallas alcanzables y los botones se derivan del cruce entre los
  permisos de la sesión y el campo `permission` del contrato.
- [ ] Una prueba falla si el permiso declarado por un contrato deja de coincidir con el que
  exige su caso de uso.
- [ ] Una acción invocada sin permiso sigue respondiendo `FORBIDDEN` sin producir efectos,
  aunque la interfaz la hubiera mostrado.
- [ ] Navegar al hash de una ruta no autorizada muestra un estado explicable, sin pantalla
  vacía ni detalle interno.
- [ ] Ninguna respuesta tocada registra ni devuelve PIN, token, stack trace o detalle interno.
- [ ] `pnpm test`, `pnpm typecheck` y `pnpm lint` quedan verdes.

## Fuera de alcance

- Alta de usuarios, creación de roles y asignación de permisos: pertenecen a 9B.09.
- Siembra de roles predefinidos: es la decisión pendiente de 9B.09.
- Cambiar dónde ocurre la autorización; sigue dentro del caso de uso.
- Permisos nuevos: cada uno llega con la sub-fase que crea su capacidad.
