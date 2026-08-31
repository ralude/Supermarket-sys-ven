# Diseño del orquestador de arranque fiscal

- **Última revisión:** 2026-08-31
- **Estado:** diseño aprobado dentro de 8.00; composición pendiente de evidencia
  de reconciliación y del runtime propietario

## Responsabilidad

El servicio fiscal local que comparte el límite operativo con SQLite es el único
componente que puede habilitar operaciones del dispositivo. Electron puede
supervisarlo, pero renderer, rutas y otros procesos no abren el puerto ni
deciden que la recuperación terminó.

El health check técnico puede responder mientras se recupera el nodo. Las rutas
que causan efectos fiscales permanecen cerradas con un código estable hasta que
el orquestador alcance `READY`.

## Estados

```text
STARTING -> SCANNING -> READY
                    \-> RECOVERY_REQUIRED
RECOVERY_REQUIRED -> SCANNING
READY -> STOPPING
```

- `STARTING`: SQLite está disponible, pero todavía no se aceptan operaciones.
- `SCANNING`: se enumeran documentos activos y jornadas con reportes
  `PENDING`, `PRINTING`, `ERROR` o `RETRYING`; luego se identifica y consulta el
  dispositivo sin mutarlo.
- `RECOVERY_REQUIRED`: existe intención pendiente, resultado ambiguo,
  incompatibilidad o falta de evidencia. El bloqueo conserva motivo e IDs.
- `READY`: no existe backlog sin resolver, la identidad está en allowlist y el
  dispositivo puede aceptar una nueva operación.
- `STOPPING`: se rechaza trabajo nuevo y se termina el owner según el protocolo.

Un puerto abierto nunca produce por sí solo `READY`.

## Secuencia obligatoria

1. Abrir SQLite y verificar migraciones.
2. Adquirir el ownership lógico del dispositivo; cuando exista binding nativo,
   comprobar que no haya otro proceso con el lock.
3. Consultar `FiscalDocumentRepository.findRecoverable()` y
   `FiscalDayRepository.findRecoverable()` para enumerar, sin límite de uno,
   toda intención `PENDING`, `PRINTING`, `ERROR` o `RETRYING`.
4. Si no hay backlog, abrir/probar identidad y estado mediante consultas no
   mutantes; habilitar solo si perfil, modelo y firmware coinciden.
5. Si hay backlog, entrar en `RECOVERY_REQUIRED`. No reproducir comandos ni
   tramas persistidas.
6. Reconciliar cada intención mediante evidencia positiva del adaptador. Un
   documento o reporte `PENDING` puede continuar por su caso de uso idempotente
   solo después de demostrar que ese intento nunca inició; `UNKNOWN` permanece
   bloqueado.
7. Volver a enumerar SQLite. Alcanzar `READY` únicamente si no queda ninguna
   intención activa o ambigua y el estado físico es compatible.

## Contrato previsto

La composición tendrá una puerta compartida por factura, nota, X, Z y status:

- `initialize()` ejecuta el barrido una sola vez por epoch del proceso;
- `getReadiness()` devuelve estado, motivo estable y referencias redactadas;
- `requireReady()` rechaza efectos con `FISCAL_STARTUP_RECOVERY_PENDING` o
  `FISCAL_DEVICE_RECOVERY_REQUIRED`;
- `beginRecovery()` adquiere la misma exclusión single-flight del dispositivo;
- `rescan()` solo se permite después de una acción de reconciliación o
  intervención registrada.

La puerta vive fuera de dominio. Los casos de uso conservan reglas fiscales y el
coordinador de infraestructura serializa el único dispositivo. El estado durable
continúa en `FiscalDocument` y `FiscalDay`; la readiness volátil se reconstruye
en cada arranque.

## Casos de prueba antes de componerlo

- Sin backlog y con identidad permitida alcanza `READY` sin emitir comandos.
- Documento `PENDING` no desaparece del barrido ni se reenvía automáticamente.
- Documento `PRINTING/ERROR` con coincidencia autoritativa se marca emitido una
  vez; una referencia distinta produce bloqueo inconcluso.
- X o Z `PENDING/PRINTING/ERROR/RETRYING` impide nuevas facturas y reportes.
- Timeout al consultar el dispositivo conserva `RECOVERY_REQUIRED` después de
  reiniciar el proceso.
- Documento comprometido con impresión incompleta no genera otra factura.
- Dos llamadas concurrentes a inicialización comparten el mismo resultado y no
  crean dos owners.
- El health técnico funciona durante recuperación, pero toda operación fiscal
  devuelve el código de bloqueo sin tocar el puerto.

## Dependencias que impiden implementarlo todavía

- `ReconcileFiscalReport` y evidencia autoritativa de X/Z.
- Decisión del runtime propietario y mecanismo de hard recovery del binding.
- Handshake e identidad del primer perfil confirmado.

La evidencia neutral y sus consultas persistibles ya están implementadas; las
dependencias restantes se resuelven dentro de 8.01–8.04. El diseño es el entregable
de 8.00 y la implementación/composición se ejecuta en 8.04, por lo que no crea
una dependencia circular que impida iniciar 8.01. Hasta entonces la consulta de
reportes recuperables está implementada, pero no se publica una readiness falsa.
