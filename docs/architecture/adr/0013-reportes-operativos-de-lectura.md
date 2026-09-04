# ADR-0013: Reportes operativos de lectura, permisos y exportación

- Estado: Aceptado
- Fecha: 2026-09-03

## Contexto

La sub-fase 9.06 necesita mostrar cierres de caja, auditoría y estado fiscal sin
mezclar consultas con comandos. Los casos de uso `GetCashClosureReport`,
`GetAuditReport` y `GetFiscalOperationsReport` existían sin permisos aprobados,
sin alcance acordado, sin adaptador de lectura y sin contrato HTTP. El plan de
9.06 dejó cuatro decisiones abiertas que bloqueaban la implementación: permisos,
alcance y límites, semántica de la exportación y origen de la jornada de X/Z.

`10-logs.md` ya fija qué datos no pueden salir de la auditoría y ADR-0012 ya fija
que la autorización ocurre en aplicación antes de leer. Este ADR no repite esas
normas: las aplica a las lecturas de reportes.

## Decisión

### Permisos

- Las tres lecturas exigen sesión válida y un permiso propio y estable:
  `reports.cash.read`, `reports.audit.read` y `reports.fiscal.read`.
- La autorización se ejecuta en el caso de uso antes de tocar el repositorio de
  lectura. Una denegación devuelve `FORBIDDEN` sin ejecutar la consulta.
- Los tres permisos se incorporan al conjunto del administrador inicial. Su
  asignación a otros roles permanece configurable.
- No existe un permiso separado de exportación (ver más abajo).

### Alcance y límites

- Los tres reportes filtran por período UTC `from`/`to` opcional. Caja acepta
  además `cashRegisterId`; auditoría acepta `actorId`, `action` y `entityType`.
- Los filtros son opcionales, pero el número de filas nunca lo es: la aplicación
  aplica un límite predeterminado de 100 filas y un máximo de 500. Un límite
  ausente, no entero o fuera de rango se recorta al rango permitido; la consulta
  nunca se ejecuta sin límite.
- El orden es descendente y estable por el instante del hecho.
- La auditoría expone actor, roles, acción, entidad, motivo, terminal, nodo,
  UTC y correlación. No expone `beforeState` ni `afterState`: son resúmenes de
  agregado que pueden contener datos excluidos por `10-logs.md` y ninguna
  pantalla de 9.06 los necesita.
- La fiscalidad expone estado, intentos, número, error público y los cuatro ejes
  de evidencia neutral, siempre con `fiscalMode: "SIMULATION"`.
- Ninguna lectura decide reconciliación ni recuperabilidad; solo proyecta.

### Exportación

- La exportación es CSV generado en el renderer a partir de la proyección ya
  autorizada y visible. No agrega columnas, no consulta otra vez y no usa Node,
  IPC ni dependencias nuevas.
- Exportar no exige un permiso distinto ni escribe auditoría de negocio: no
  revela nada que la lectura autorizada no haya entregado ya a ese actor. Si más
  adelante se exige rastrear la extracción, la exportación deja de ser local y
  pasa a ser una operación de aplicación autorizada; no se simula ese control en
  React.
- El CSV escapa comillas y neutraliza celdas que comiencen por `=`, `+`, `-` o
  `@` para que una hoja de cálculo no las interprete como fórmula.

### Jornada de X/Z

- La jornada y la fecha de negocio de un X/Z simulado se capturan manualmente en
  la pantalla y viajan en el request. La API no publica una lectura de jornada
  actual y 9.06 no la inventa.
- X/Z permanece fuera de las consultas: vive en su propia sección, requiere
  capability, confirmación explícita, motivo, consentimiento e idempotencia.

## Consecuencias

- Los códigos de permiso de reportes forman parte del contrato estable de
  aplicación.
- La UI puede exportar sin introducir una superficie de auditoría no aprobada, y
  el camino para exigirla más adelante queda explícito.
- El límite de filas impide que una consulta de auditoría descargue el ledger
  completo desde una estación.
- La ausencia de lectura de jornada actual queda registrada como brecha de la
  API, no como una decisión de presentación.
