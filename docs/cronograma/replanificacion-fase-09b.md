# Replanificacion: insercion de Fase 9B antes de Fase 10

- **Fecha de decision:** 2026-09-04
- **Estado:** Aprobada
- **Fase insertada:** Fase 9B - Perfiles operativos y capacidades faltantes
- **Fase activa:** Fase 9B
- **Fase pospuesta:** Fase 10 - Sincronizacion, que no habia iniciado ninguna tarea
- **Motivo:** la interfaz entregada en Fase 9 esta organizada por modulo tecnico y no por
  trabajo real de una persona; ademas, cinco perfiles operativos del negocio dependen de
  capacidades que todavia no existen en dominio, aplicacion ni contratos.

## Decision

Se inserta la Fase 9B entre la Fase 9 y la Fase 10, sin renumerar ninguna fase existente.
Esta excepcion aplica la regla 5 del cronograma: la Fase 10 conserva sus cuatro sub-fases
intactas y vuelve a ser la fase activa cuando la Fase 9B cierre.

La Fase 9 no se reabre. Sus ocho sub-fases y la correctiva 9.08 permanecen completadas; la
Fase 9B es trabajo nuevo, no una correccion de lo ya entregado.

## Motivo detallado

La auditoria de `apps/desktop` del 2026-09-04 encontro que:

- La sesion entrega `roleCodes` y el renderer nunca los lee. El unico campo consumido es
  `displayName`. No existe renderizado condicional por rol ni por permiso en toda la
  aplicacion de escritorio, de modo que cualquier operador ve todas las pantallas y descubre
  que no esta autorizado solo cuando el servidor responde `403`.
- `SessionPrincipal` ya calcula `permissionCodes`, pero el mapper HTTP los descarta y el
  esquema de respuesta los prohibe por `additionalProperties: false`.
- El campo `permission` que cada contrato HTTP declara no lo lee ningun codigo: es metadata
  documental que puede desviarse en silencio de la constante que el caso de uso exige.
- Varias pantallas exigen que el operador escriba identificadores internos a mano.
- Las capacidades que los perfiles de negocio requieren (devoluciones, proveedores como
  entidad, costo de compra, conteos, transferencias, clientes con RIF, usuarios y roles,
  configuracion de datos maestros y KPIs) no existen en ninguna capa.

Construir la Fase 10 sobre esa base significaria sincronizar entre nodos una operacion que
todavia no cubre el trabajo de cuatro de los cinco perfiles.

## Alcance adelantado desde otras fases

- **De la Fase 11 (11.02 Roles y permisos):** ~~la sub-fase 9B.09 adelanta la administracion de
  identidad, es decir el alta de usuarios, la creacion de roles y la asignacion de permisos
  desde la interfaz.~~ **Revertido el 2026-09-04**, ver la correccion mas abajo. La 11.02
  conserva la auditoria de decisiones de autorizacion y sus pruebas de anulaciones, retiros,
  ajustes y cambios de precio; la 11.04 y la 11.05 conservan cifrado y hardening de logs sin
  cambios.
- El corte minimo 11.01-11.03 del gate de seguridad pre-UI ya esta completado y no se
  modifica.

## Correccion del 2026-09-04: la Fase 9B deja de adelantar alcance de la Fase 11

Esta replanificacion previo que una decision documentada posterior pudiera recortar el alcance
de la Fase 9B. Esa decision se toma aqui.

**Motivo.** Adelantar la administracion de identidad dejaba la misma capacidad planificada en
dos fases con dos criterios de salida distintos. Una fase de perfiles operativos no debe ser
tambien la duena de identidad y autorizacion.

**Recorte.** La sub-fase 9B.09 se retira de la Fase 9B y su alcance completo —objetivo,
contexto, decision pendiente sobre siembra de roles y sus seis tareas— vuelve a
[11.02 Roles y permisos](./fase-11-seguridad/11.02-roles-permisos.md). El numero 9B.09 no se
reutiliza y ninguna otra sub-fase se renumera, conforme a la regla 6 del cronograma. La Fase
9B queda con dieciocho sub-fases activas.

**Revision del resto de la fase.** Se revisaron las demas sub-fases contra las Fases 10, 11 y
12. Ninguna otra duplica alcance ya planificado: 9B.08 y 9B.11 delimitan explicitamente lo que
pertenece a Fase 10 sin que exista una sub-fase 10.01-10.04 que lo cubra; 9B.12 publica
capacidades de caja que 11.02 solo prueba desde la autorizacion; 9B.13 publica lecturas que la
Fase 12 no planifica, porque esa fase optimiza con medicion lo que ya existe.

**Consecuencia aceptada.** Hasta que 11.02 se implemente, el unico rol disponible es el
administrador que provisiona el bootstrap por CLI. Los perfiles 9B.14-9B.18 siguen derivando
sus vistas de los `permissionCodes` que la sesion declara —mecanismo ya entregado por 9B.00 y
fijado en ADR-0015— y se validan con sesiones provisionadas por ese medio. La Fase 9B no
publica una pantalla de alta de operadores.

## Limites de la Fase 9B

- No se ejecuta ninguna tarea de Fase 10: sin cola de sincronizacion, sin protocolo de
  eventos entre nodos, sin servidor receptor y sin resolucion de conflictos.
- La sucursal se modela unicamente como dato maestro y etiqueta de pertenencia. Su autoridad
  de escritura multi-nodo pertenece a Fase 10 y a
  [`12-sincronizacion-y-ownership.md`](../architecture/12-sincronizacion-y-ownership.md).
- La existencia conserva un almacén implícito por nodo. Las transferencias, tanto entre
  almacenes como entre nodos, quedan diferidas; una futura transferencia entre nodos requiere
  Fase 10 por cambiar la autoridad de escritura.
- La Fase 8 sigue suspendida. La nota de credito de una devolucion se emite contra
  `FiscalPrinterFake`, se rotula `SIMULACION` y no declara emision fiscal real.
- No se optimiza rendimiento. La Fase 12 conserva su alcance de medicion antes y despues.
- No se agregan dependencias sin necesidad concreta y documentada. Si la cobertura de
  interaccion DOM justifica un entorno de pruebas de navegador, se decide y se registra de
  forma explicita, no como efecto colateral de una sub-fase.

## Condicion para avanzar a Fase 10

La Fase 10 se retoma desde 10.01 cuando las dieciocho sub-fases activas de la Fase 9B esten
completadas, o cuando una decision documentada posterior recorte el alcance de la Fase 9B y
declare cuales de sus sub-fases quedan diferidas. La correccion del 2026-09-04 ya ejercio esa
salida al retirar 9B.09.

Antes de iniciar 10.01 también debe asignarse de forma explícita la decisión nodo↔sucursal
que 9B.11 dejó fuera de alcance. Declarar que pertenece a Fase 10 no basta mientras ninguna
sub-fase 10.01-10.04 la incluya: una decisión posterior debe incorporarla a una sub-fase
concreta o registrar un diferimiento con dueño y criterio de salida. Esto no autoriza a
ejecutar trabajo de Fase 10 durante 9B.

## Corrección de alcance YAGNI — 2026-09-04

La revisión posterior aplicó [ADR-0021](../architecture/adr/0021-mvp-referencia-no-certificado.md)
y sustituyó el gate global por defaults explícitos de referencia. La versión anterior de este
documento, que marcaba seis bloqueos directos, queda supersedida: sirve como historial de por
qué se investigaron las decisiones, no como condición vigente de implementación.

9B.04, 9B.05, 9B.06 y 9B.10 avanzan con alcance mínimo y reemplazable. 9B.12 avanza con
arqueos, lecturas e historia; la reapertura se difiere. 9B.08 se difiere porque el MVP conserva
un almacén implícito por nodo. Los perfiles 9B.14-9B.18 se componen de forma incremental y
declaran las capacidades que todavía no están disponibles.

## Efecto sobre los niveles de entrega

Esta replanificacion no habilita piloto, produccion ni una declaracion de compatibilidad
fiscal real. El gate de piloto y release sigue exigiendo reanudar y completar la Fase 8 con
sus dos perfiles exactos y toda la evidencia de su criterio de salida.
