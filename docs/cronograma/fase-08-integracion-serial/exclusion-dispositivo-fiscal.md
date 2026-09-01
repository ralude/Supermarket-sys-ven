# Exclusión única por dispositivo fiscal

- **Fecha:** 2026-08-31
- **Estado:** Contrato y casos de aceptación definidos; implementación en 8.03
- **Decisiones:** [ADR-0010](../../architecture/adr/0010-transporte-serial-y-protocolos-fiscales.md)

## Invariante

Para cada `deviceId` existe una sola puerta de coordinación en el servicio
fiscal local. A lo sumo una operación puede poseerla y tocar el adaptador o su
runtime físico. La misma puerta cubre:

- factura y nota fiscal desde antes de persistir `PRINTING` hasta persistir el
  resultado o error;
- reportes X y Z desde antes de persistir `PRINTING` hasta persistir el
  resultado o error;
- reconciliación de documento o reporte;
- identificación, status y consultas de salud que accedan al dispositivo;
- barrido de arranque y recuperación manual.

Una respuesta de health que no consulta hardware puede leer la proyección
volátil sin adquirir la puerta. En cambio, un heartbeat o status físico nunca
se intercala en una sesión fiscal abierta salvo que el perfil lo autorice de
forma expresa y exista una prueba específica.

## Frontera de la posesión

El coordinador se identifica por `deviceId`, no por puerto COM: cambiar la ruta
física no crea otro dispositivo lógico ni elude una recuperación pendiente.
Cada trabajo obtiene un lease opaco con `operationId` y `connectionEpoch`.

La secuencia de una emisión es:

1. adquirir la puerta sin una transacción SQLite abierta;
2. comprobar readiness y backlog durable;
3. persistir intención/`PRINTING` en una transacción corta;
4. ejecutar I/O sin transacción SQLite;
5. persistir confirmación o evidencia de error en otra transacción corta;
6. liberar el lease solo después de dejar un estado durable coherente.

Si el proceso o runtime falla, no se «libera» el efecto fiscal por memoria. El
startup reconstruye readiness desde SQLite y mantiene la puerta en recuperación
hasta reconciliar o escalar. Un lease de otro `connectionEpoch` no puede aceptar
una respuesta tardía.

## Política de cola

- FIFO acotada en memoria por `deviceId`, sin prioridades que interrumpan una
  sesión fiscal;
- no es durable y nunca contiene tramas para replay después de reiniciar;
- la recuperación de startup adquiere la puerta antes de admitir trabajo nuevo;
- cola llena, cierre en curso, incompatibilidad o backlog ambiguo rechazan con
  un código estable sin tocar el runtime;
- cancelar espera solo retira un trabajo cuya etapa sea `QUEUED` o
  `WRITE_NOT_INVOKED`; vencer un deadline después de `write()` no cancela I/O;
- un cierre deja de aceptar trabajo, resuelve o conserva ambiguo el owner actual
  según evidencia, y descarta lo todavía no iniciado con resultado explícito.

Los límites, códigos y telemetría concreta se implementan en 8.03 después de
conocer el framing y las restricciones del primer perfil. Este contrato no
introduce una cola durable ni una abstracción universal de protocolos.

## Casos de aceptación para 8.03

1. Una factura en vuelo impide que status, X, Z o una nota invoquen el adaptador
   hasta que la factura deje estado durable.
2. Un Z en vuelo impide facturas y un segundo Z; ninguna prioridad lo adelanta
   o interrumpe.
3. Reconciliación de documento y de reporte usan la misma puerta que emisión.
4. Dos solicitudes concurrentes del mismo `deviceId` ejecutan en FIFO y nunca
   producen dos llamadas simultáneas al transporte.
5. Dispositivos lógicos distintos pueden avanzar en paralelo sin compartir
   estado, lease ni `connectionEpoch`.
6. Un status físico se encola detrás de una sesión; el health técnico basado en
   proyección sigue respondiendo sin I/O.
7. Saturar la cola rechaza el trabajo excedente sin persistir `PRINTING` ni
   invocar `write()`.
8. Cancelar antes de `write()` produce `NOT_STARTED`; cancelar o vencer después
   de `write()` conserva evidencia ambigua y no inicia otro owner.
9. Una respuesta tardía de otro epoch/operación se descarta y lleva la intención
   afectada a recuperación.
10. Reiniciar elimina la cola volátil, enumera todas las intenciones durables y
    no acepta trabajo hasta que el barrido vuelva a demostrar readiness.
11. Ninguna prueba mantiene una transacción SQLite abierta mientras el fake,
    transporte o runtime nativo está esperando.
12. El cierre supervisado no crea un nuevo proceso hijo hasta observar la salida
    del anterior y comprobar la liberación exclusiva del recurso.

Estos casos se convierten en pruebas ejecutables en 8.03. Las pruebas HIL por
frontera temporal se repiten en 8.06 y 8.09; una suite con fake no demuestra
locks del sistema operativo ni cancelación del binding nativo.
