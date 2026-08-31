# Cronograma del Proyecto

Este directorio es la fuente única de verdad para el avance por fases. Cada fase tiene un README explicativo y un archivo independiente por sub-fase.

## Estado actual

| Fase | Nombre | Estado |
|---:|---|---|
| 0 | Arquitectura | ~~Completada~~ |
| 1 | Infraestructura | ~~Completada~~ |
| 2 | Codigo de negocio | ~~Completada~~ |
| 3 | Persistencia | ~~Completada~~ |
| 4 | Ledger, outbox y auditoria | ~~Completada~~ |
| 5 | Caja operativa | ~~Completada~~ |
| 6 | Inventario operativo | ~~Completada~~ |
| 7 | Driver fiscal fake | ~~Completada~~ |
| 8 | Integracion serial | En curso |
| 9 | UI | Pendiente |
| 10 | Sincronizacion | Pendiente |
| 11 | Seguridad | Pendiente |
| 12 | Optimizacion | Pendiente |

**Fase actual:** Fase 8 - Integracion serial
**Sub-fase actual:** 8.00 - Gate de evidencia, contrato y proveedor

## Fases

- [~~Fase 0 - Arquitectura~~](./fase-00-arquitectura/README.md)
- [~~Fase 1 - Infraestructura~~](./fase-01-infraestructura/README.md)
- [~~Fase 2 - Codigo de negocio~~](./fase-02-dominio/README.md)
- [~~Fase 3 - Persistencia~~](./fase-03-persistencia/README.md)
- [~~Fase 4 - Ledger, outbox y auditoria~~](./fase-04-event-store/README.md)
- [~~Fase 5 - Caja~~](./fase-05-caja/README.md)
- [~~Fase 6 - Inventario~~](./fase-06-inventario/README.md)
- [~~Fase 7 - Driver fiscal fake~~](./fase-07-driver-fiscal-fake/README.md)
- [Fase 8 - Integracion serial](./fase-08-integracion-serial/README.md)
- [Fase 9 - UI](./fase-09-ui/README.md)
- [Fase 10 - Sincronizacion](./fase-10-sincronizacion/README.md)
- [Fase 11 - Seguridad](./fase-11-seguridad/README.md)
- [Fase 12 - Optimizacion](./fase-12-optimizacion/README.md)

## Reglas de seguimiento

1. Toda tarea terminada se marca como `- [x] ~~tarea~~` en su archivo de sub-fase.
2. Cuando todas las tareas de una sub-fase terminan, se marca su estado como `Completada` y se tacha el enlace en el README de la fase.
3. Cuando todas las sub-fases terminan, se tacha la fase en este índice y se avanza la fase actual.
4. Cada cambio de código o configuración debe indicar la fase y sub-fase que modifica.
5. No se trabaja en una fase futura mientras la fase actual tenga tareas abiertas, salvo una decisión documentada.
6. Las tareas completadas se conservan tachadas; no se eliminan del historial del cronograma.

## Adaptaciones aprobadas

- `currency` se incluye en la Fase 2 porque las ventas requieren moneda, tasas y pagos mixtos.
- `identity` se divide: el modelo `User`/`Role`/`Permission` se crea en la Fase 2; autenticacion, JWT y cifrado quedan en la Fase 11.
- `inventory` se divide: el dominio de movimientos se crea en la Fase 2; su flujo operativo y persistencia quedan en la Fase 6.
- La Fase 2 no imprime ni persiste; la persistencia comienza en la Fase 3 y el driver fiscal fake en la Fase 7.
- CI/CD se ejecuta inicialmente como scripts locales mediante `pnpm pipeline`, sin asumir una plataforma remota.
- La actualizacion diaria de tasas se resuelve con carga manual mas sugerencia externa con confirmacion humana (el driver propone, un humano confirma via `UpdateExchangeRate`); se agrega la sub-fase 9.07 a la Fase 9. La tasa externa nunca se aplica sola y el sistema opera offline con la ultima tasa vigente.
- La sub-fase 2.02 incluye la capa de aplicación del módulo `currency` (`UpdateExchangeRate`, `GetCurrentExchangeRate`, `CalculateMixedPaymentTotals`) porque 06-casos-de-uso.md las asigna a ese módulo y no había otra sub-fase que las cubriera.
- La sub-fase 2.03 implementa catálogo con referencias configurables de categoría y unidad, snapshots de producto y validación de barcode por puertos; no agrega persistencia ni CRUD de configuración.
- La sub-fase 2.04 implementa ventas puras con precio neto, descuentos porcentuales por línea, IGTF configurable, pagos mixtos exactos y autorización mínima; no modifica caja, inventario ni fiscalidad persistida.
- La sub-fase 2.05 implementa `Shift` como agregado de caja con ownership por terminal/nodo, movimientos manuales de efectivo, balances multi-moneda y cierre con arqueo; persistencia, auditoria y pagos derivados de venta quedan para fases posteriores.
- La sub-fase 2.06 implementa permisos de codigo estable, roles configurables y usuarios sin credenciales; autenticacion, sesiones, JWT y cifrado permanecen en la Fase 11.
- La sub-fase 2.07 implementa `StockItem` con movimientos append-only, cantidades escaladas y lotes opcionales; persistencia, FEFO, kardex e integracion con ventas permanecen en la Fase 6.
- La Fase 6 persiste inventario como movimientos append-only, recibe compras mediante un contrato minimo, descuenta ventas con FEFO e idempotencia y deriva el kardex sin almacenar saldos mutables.
- La Fase 7 implementó el puerto fiscal, un fake determinista, estados
  persistentes recuperables, emision y reportes X/Z. El gate 8.00 ya separó sus
  controles privados de las suites semánticas exclusivas de simulador y aisló
  X/Z detrás de consentimiento simulado explícito. No instala ni usa SerialPort.
- La Fase 8 comienza por 8.00 para cerrar las deudas de recuperacion de la Fase 7 y habilitar un primer perfil con evidencia primaria. El transporte serial y la recuperacion neutral se estabilizan con ese perfil; luego un gate, adaptador y HIL independientes califican el segundo, reutilizando SerialPort solo si su via oficial es compatible. La fase solo termina con dos combinaciones exactas soportadas, inicialmente candidatas PNP y The Factory HKA/ACLAS. ADR-0010 limita la genericidad al contrato semantico y, cuando aplica, al transporte serial; cada protocolo o SDK, modelo y firmware requiere evidencia y calificacion propias.
- El corte interno de 8.00 del 2026-08-31 separa retry de terminalidad,
  persiste evidencia fiscal en cuatro ejes y añade las migraciones 0010/0011
  con recuperación determinista e integridad fail-closed. Esto no cierra el
  gate: siguen pendientes fabricante, protocolo, registro, runtime y equipo.
- La planificacion regulatoria de Fase 8 reconoce que SNAT/2026/00084 derogo la SNAT/2024/000121 el 2026-08-12. La autorizacion por modelo y el registro del desarrollador ante el fabricante de SNAT/2018/0141 se verifican nuevamente antes del piloto.
- La Fase 1 se completó con Electron, React, Fastify, SQLite, Drizzle y ESLint instalados y verificados mediante smoke tests.
- ADR-0008 establece terminales POS autonomas con Fastify y SQLite local; el nodo coordinador sincroniza eventos y datos de referencia.
- ADR-0009 establece tablas relacionales como fuente de verdad, ledger append-only para historia y outbox para entrega; no se usa event sourcing completo en el MVP.
- Antes de la Fase 9 se ejecuta el gate de seguridad de transporte autorizado el 2026-08-14; no adelanta cifrado ni hardening final de la Fase 11.
- El [hito transversal de cierre arquitectonico](./hito-cierre-arquitectonico.md) se completo el 2026-08-14 y habilito la continuacion desde 2.03.

## Documentos transversales

- [Estrategia de testing](./testing.md)
- [CI/CD local](./ci-cd.md)
- [Hito de cierre arquitectonico](./hito-cierre-arquitectonico.md)
- [Gate de seguridad antes de UI operativa](./gate-seguridad-pre-ui.md)
- [Gate de piloto y release](./gate-piloto-release.md)
- [Alcance por nivel de entrega](../producto/alcance-entregas.md)
