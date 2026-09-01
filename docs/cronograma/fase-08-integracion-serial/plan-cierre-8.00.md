# Plan de cierre de la sub-fase 8.00

- **Fecha de corte:** 2026-08-31
- **Estado:** En ejecución; cierre condicionado por evidencia externa
- **Fuente de tareas:** [Gate 8.00](./8.00-gate-evidencia-proveedor.md)

## Resultado esperado

8.00 habilita 8.01 únicamente cuando el primer perfil tenga evidencia primaria,
protocolo vigente, registro del integrador, equipo o simulador oficial controlado
y una decisión de runtime demostrada en Windows x64. El repositorio no convierte
una búsqueda web, un manual de otra familia ni un fake en evidencia del equipo
seleccionado.

## Corte de ejecución

### Trabajo que puede cerrarse desde el repositorio

1. Mantener las garantías heredadas de recuperación y persistencia ya cubiertas
   por las migraciones 0010–0012.
2. Sacar el desktop de Electron 37 EOL y verificar la rama estable seleccionada.
3. Fijar la decisión del owner lógico y del runtime físico del binding nativo.
4. Fijar `serialport` 13.0.0 como candidato exclusivo del spike, sin incorporarlo
   todavía a manifests ni lockfile de producción.
5. Dejar especificados hard recovery, exclusión única y evidencia exigida para
   ejecutar el spike con un puerto real o virtual controlado.

### Trabajo bloqueado por terceros o laboratorio

- constancia vigente de autorización y no suspensión del modelo;
- confirmación de modelo, firmware, protocolo, interfaz, driver y DCTD;
- registro completado del desarrollador ante fabricante o representante;
- revisión tributaria vigente y decisión de campos fiscales abiertos;
- protocolo o SDK entregado por canal formal y sus binarios verificables;
- disponibilidad comercial, centro autorizado y equipo de laboratorio;
- pruebas del binding nativo con COM controlado, segundo proceso y artefacto
  empaquetado;
- consultas autoritativas para reconciliar documentos y reportes X/Z.

Estos puntos permanecen abiertos aunque el código y la documentación interna
estén completos.

## Criterios de aceptación del corte interno

- `apps/desktop` fija una versión exacta de una rama Electron estable soportada
  el 2026-08-31 y regenera el lockfile sin agregar `serialport`.
- El build, typecheck y pruebas existentes del desktop pasan con esa versión.
- El servicio fiscal del servidor es el único owner lógico. Un proceso hijo
  supervisado es el único owner físico del binding; renderer, preload, rutas y
  el proceso SQLite no abren el dispositivo.
- Un deadline no se interpreta como cancelación. El supervisor no crea un nuevo
  proceso hijo hasta terminar el anterior y comprobar que el recurso quedó
  liberado.
- Factura, nota, X, Z, reconciliación y status comparten una sola puerta por
  dispositivo. Su FIFO, epochs y pruebas temporales se implementan en 8.03,
  después del codec, sin adelantar esa sub-fase.
- `ReconcileFiscalReport` no se implementa contra `getStatus()` del fake ni a
  partir de una referencia inventada. Su contrato se completa cuando el primer
  perfil documente contadores o consultas autoritativas de X/Z.
- El cronograma solo marca tareas cuya evidencia pueda verificarse en el mismo
  cambio; el estado de 8.00 continúa `Pendiente` mientras exista un bloqueo
  externo.

## Secuencia restante

1. Verificar la actualización Electron y documentar el runtime elegido.
2. Solicitar y archivar la evidencia formal del perfil PNP candidato.
3. Resolver con fabricante y asesoría el gap del contrato fiscal; escribir
   primero las pruebas outside-in y después la migración forward-only.
4. Ejecutar el spike desechable de SerialPort 13.0.0 con el equipo o un puerto
   virtual controlado, incluyendo lock de segundo proceso y hard recovery.
5. Registrar resultados, eliminar el workspace del spike y reevaluar cada
   checkbox de 8.00.
6. Empezar 8.01 solo si el criterio de salida completo queda satisfecho.

## Evidencia de verificación

Los comandos, versión efectiva, build y limitaciones del corte se registran en
[la decisión de runtime nativo](./runtime-nativo-8.00.md). La evidencia recibida
de fabricantes conserva canal, fecha, versión, hash o firma y licencia en el
expediente restringido que corresponda; no se incorporan secretos ni binarios
propietarios al repositorio.
