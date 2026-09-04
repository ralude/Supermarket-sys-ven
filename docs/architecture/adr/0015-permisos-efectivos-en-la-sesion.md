# ADR-0015: Permisos efectivos en la sesión y navegación derivada en el renderer

- Estado: Aceptado
- Fecha: 2026-09-04

## Contexto

La auditoría de `apps/desktop` del 2026-09-04 encontró que `SessionPrincipal`
ya calcula `permissionCodes` (unión de los permisos activos de los roles
activos del actor), pero el mapper HTTP de la ruta de sesión los descartaba y
el esquema de `SessionResponse` los prohibía por `additionalProperties: false`.
En paralelo, cada contrato HTTP ya declara en su campo `permission` el permiso
que su comando exige — incluida la forma alternativa `"a|b"` para los dos
comandos con dos permisos posibles — pero ningún código lo leía: era metadata
documental que podía desviarse en silencio de la constante que el caso de uso
realmente exige.

Sin esto, el renderer no tiene forma de saber qué puede hacer el operador:
todo usuario ve todas las pantallas y botones, y una acción no autorizada solo
se descubre cuando el servidor responde `FORBIDDEN`. La sub-fase 9B.00 cierra
esa brecha como fundación de la Fase 9B.

## Decisión

### Contrato

`SessionResponse` (login y recuperación de sesión, que comparten el mismo
esquema `200`) agrega `permissionCodes: readonly string[]`, obligatorio y
presente aunque esté vacío — un actor sin permisos recibe un arreglo vacío,
nunca un campo ausente. `SessionPrincipal` ya lo entrega ordenado y sin
duplicados (consulta SQL con `order by p.code` sobre roles y permisos activos);
el mapper HTTP deja de descartarlo.

No se publica el mapa rol→permiso. El cliente recibe el efecto (qué puede
hacer este actor), nunca la política (quién otorga qué): eso permanece
configuración del servidor, como ya fija ADR-0012.

### Evaluador compartido

`packages/shared` publica `isPermissionGranted(required, grantedPermissionCodes)`,
que resuelve las tres formas que el campo `permission` de un contrato admite:
`null` (sesión válida basta), un código simple, o `"a|b"` (satisfecho con
cualquiera de los dos). No se introducen comodines, jerarquías ni permisos
derivados: ninguna de esas formas existe hoy.

### El servidor sigue siendo la única autoridad

El evaluador y los permisos de la sesión solo deciden qué **ofrece** la
interfaz — qué rutas se listan, qué pantallas se alcanzan y qué botones se
habilitan. Ninguno sustituye la autorización real: el caso de uso vuelve a
autorizar cada intento, exactamente como antes. Ocultar una acción nunca
reemplaza autorizarla, el mismo principio que ADR-0014 ya fija para el
formulario de confirmación de tasa.

### El campo `permission` deja de ser documentación

Una prueba (`apps/server/src/permission-contracts.test.ts`) cruza, para las 18
rutas de comando, el permiso que su contrato declara contra la constante que
su caso de uso real exige (`packages/core/src/application/*/permissions.ts`).
Si alguno de los dos cambia sin el otro, la prueba falla: el contrato ya no
puede desviarse en silencio de la regla real de autorización.

### Alcance de la navegación derivada

La mayoría de las pantallas combinan lecturas abiertas a cualquier sesión
válida (`permission: null`) con comandos que sí exigen un permiso concreto:
ocultar la pantalla completa sería incorrecto para esas — un cajero sin
`catalog.product.create` debe poder seguir buscando productos. Por eso:

- **A nivel de botón**, cada acción de comando queda deshabilitada cuando la
  sesión no tiene el permiso que su contrato declara, usando el contrato real
  importado desde `@supermarket/shared` (no un permiso reescrito a mano en el
  renderer).
- **A nivel de ruta**, una pantalla completa solo se retira de la navegación
  cuando *ninguna* de sus acciones es de solo sesión — hoy eso ocurre
  únicamente en Reportes, cuyas tres lecturas exigen cada una su propio
  permiso (`reports.cash.read`, `reports.audit.read`, `reports.fiscal.read`).
  Si la sesión no tiene ninguno de los tres, "Reportes" no aparece en la barra
  lateral ni en los accesos directos del inicio, y navegar a su hash a mano
  (un enlace guardado, por ejemplo) muestra un panel que explica la falta de
  autorización en vez de una pantalla vacía o un detalle interno.

## Consecuencias

- Los permisos efectivos del operador forman parte del contrato estable de
  sesión.
- Un cambio futuro que agregue un permiso a un contrato sin ajustar el caso de
  uso correspondiente (o viceversa) rompe la suite de pruebas en vez de llegar
  silenciosamente a producción.
- La navegación de la Fase 9B se construye sobre este mecanismo: cada sub-fase
  que agregue una capacidad nueva solo necesita declarar el permiso de su
  contrato y usar el mismo evaluador, sin inventar una autorización propia en
  el renderer.
- Mientras exista un único rol sembrado (`ADMIN`, con los 21 permisos), este
  mecanismo no cambia lo que ningún operador ve; su efecto se vuelve visible
  recién cuando 11.02 permita crear roles con permisos distintos. Esa
  administración de identidad estuvo planificada como 9B.09 y volvió a la Fase
  11 el 2026-09-04; la decisión de este ADR no cambia por ello.
