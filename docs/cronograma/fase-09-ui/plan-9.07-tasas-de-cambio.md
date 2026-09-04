# Plan de ejecución 9.07: Tasas de cambio

- **Sub-fase:** [9.07 Tasas de cambio](./9.07-tasas-de-cambio.md)
- **Estado del plan:** Planificada; ejecución posterior al cierre de 9.06
- **Prerrequisito:** [9.06 Reportes y cierres](./9.06-pantalla-reportes.md)
- **Disciplina visual:** Ponytail `full`, limitada a presentación
- **Ownership:** nodo coordinador tras confirmación humana; distribución en Fase 10

## Resultado esperado

El operador consulta la tasa local vigente y su histórico, registra una tasa
manual autorizada o solicita una sugerencia externa. La sugerencia es una
propuesta efímera: aceptarla exige una confirmación humana explícita y ejecuta
el comando existente `UpdateExchangeRate`; rechazarla no persiste nada. Un
fallo de red solo afecta la sugerencia y nunca impide consultar o registrar una
tasa local.

## Línea base comprobada

- Dominio ya modela `ExchangeRate` inmutable con par de monedas, entero
  escalado, fuente, vigencia y actor registrador; no admite `float`.
- Aplicación ya publica `UpdateExchangeRate`, `GetCurrentExchangeRate` y
  `CalculateMixedPaymentTotals`, y el comando de actualización autoriza
  `currency.rate.update`, conserva idempotencia y escribe auditoría.
- SQLite persiste el histórico y el repositorio puede guardar, buscar por ID y
  elegir la tasa vigente más reciente de un par. No existe una query pública
  para listar el histórico.
- HTTP ya expone tasa vigente, registro manual y cálculo de pagos mixtos. A
  diferencia de lo indicado antes en 9.07, 9.00 no publicó contratos de
  histórico ni de sugerencia.
- El renderer solo contiene el destino de navegación de 9.07; no existe cliente
  ni pantalla operativa de tasas.
- ADR-0012 permite leer la tasa vigente con sesión y exige
  `currency.rate.update` para persistir cambios. ADR-0008 reserva al coordinador
  la autoridad de tasas confirmadas y deja su distribución para Fase 10.

## Decisiones requeridas antes de implementar

1. Aprobar la fuente externa y su contrato primario: pares disponibles,
   convención base/cotizada, escala, timestamp, zona horaria, atribución,
   credenciales, límites y condiciones de uso. El driver no normaliza una API
   elegida informalmente.
2. Definir qué pares puede consultar y confirmar cada tienda y si la fuente
   externa propone una tasa única o tipos distintos. El plan no presume una
   tasa regulatoria, bancaria o comercial concreta.
3. Aprobar la regla de vigencia al confirmar: `validFrom`, `validUntil` y el
   tratamiento de una tasa abierta anterior. El comportamiento actual elige la
   tasa vigente con `validFrom` más reciente, pero no cierra ni prohíbe ventanas
   solapadas.
4. Definir el alcance del histórico visible: filtros obligatorios, orden,
   período y límite de filas. No se incorpora paginación como optimización sin
   un requisito, pero tampoco se expone un histórico sin cota por accidente.
5. Confirmar si solicitar una sugerencia requiere un permiso adicional o solo
   sesión válida. Persistirla siempre conserva `currency.rate.update` en
   aplicación; ocultar botones en React no sustituye esa autorización.
6. Fijar timeout, retry y frecuencia permitida. Los reintentos de lectura pueden
   ser acotados, pero nunca deben terminar registrando o confirmando una tasa.

Estas decisiones se documentan en la especificación normativa o en un ADR si
cambian una decisión aceptada. Si no se cierran, 9.07 permanece bloqueada en su
integración externa y no presenta una fuente provisional como productiva.

## Contratos de aplicación

### Histórico local

Agregar una query `GetExchangeRateHistory` y un puerto de lectura con par y
filtros aprobados. La salida reutiliza la representación exacta de
`ExchangeRateDto`, incluye fuente y vigencia y se ordena de forma determinista.
La query lee SQLite local; no llama al proveedor externo ni reconstruye datos
desde `business_event`.

### Sugerencia externa

Definir `ExchangeRateProvider` en `core/application` y
`GetSuggestedExchangeRate` como una lectura. Su DTO mínimo contiene par,
`rateValue`, `rateScale`, fuente identificable, instante observado y, solo si
la fuente lo respalda, vigencia sugerida. No contiene un ID de tasa persistida
ni afirma que la propuesta esté activa.

El puerto devuelve un error controlado y seguro ante timeout, red no disponible,
respuesta inválida o par no soportado. La aplicación valida forma, par, entero
escalado y metadatos antes de entregar la propuesta a HTTP. Claves y respuestas
crudas quedan dentro del driver y no llegan a logs, contratos ni renderer.

### Confirmación humana

No crear un segundo comando de persistencia. La UI copia los valores visibles
de la sugerencia a un formulario revisable y, tras una confirmación explícita,
llama a `UpdateExchangeRate` con motivo y una clave de idempotencia por
intención. El servidor vuelve a autorizar y el agregado crea una nueva entrada
histórica. Editar cualquier valor convierte la acción en una confirmación de
los datos editados, nunca en una aceptación silenciosa de la respuesta externa.

Rechazar o descartar la sugerencia limpia la propuesta local y produce cero
escrituras, auditoría u outbox. Refrescar una sugerencia tampoco registra tasas.

## Contratos HTTP a publicar

- `GET /api/v1/currency/exchange-rates`: histórico local autenticado con los
  filtros y cota que se aprueben.
- `GET /api/v1/currency/exchange-rates/suggestion`: sugerencia autenticada para
  un par; nunca modifica estado y traduce fallos del proveedor a Problem
  Details estable.
- Conservar `GET /api/v1/currency/exchange-rates/current` para la tasa local
  vigente y `POST /api/v1/currency/exchange-rates` como única escritura.

Los contratos viven en `packages/shared`; Fastify autentica, valida y delega.
Las rutas no leen SQLite, no consumen directamente el proveedor y no aceptan
valores decimales de punto flotante.

## Driver externo y composición

Crear `packages/drivers/exchange-rate` solo después de aprobar una fuente. El
adaptador traduce su formato al DTO neutral del puerto, usa configuración del
servidor para URL y credenciales, aplica timeout y valida la respuesta completa.
Las pruebas usan un servidor o transporte simulado: la suite determinista no
depende de Internet ni de datos variables del proveedor.

El driver se compone en `apps/server`, nunca en React ni Electron preload. Su
ausencia o indisponibilidad deja operativas las lecturas SQLite y la carga
manual. No se añade caché externa: la única tasa utilizable por ventas sigue
siendo una entrada local confirmada.

## Pantalla React

- Mostrar por separado `Tasa vigente`, `Histórico local`, `Carga manual` y
  `Sugerencia externa` para distinguir hechos persistidos de propuestas.
- Presentar par, valor escalado formateado sin perder precisión, fuente y
  vigencia. Conservar enteros y escala originales al enviar el comando.
- Permitir revisar, confirmar o rechazar la sugerencia; no seleccionar ni
  confirmar automáticamente al cargar la pantalla.
- Ante `NETWORK_UNAVAILABLE` o timeout, mantener visibles la tasa local y el
  formulario manual y explicar que solo la sugerencia está indisponible.
- Tras una actualización exitosa, volver a consultar vigente e histórico. Una
  denegación o error no altera optimistamente la vista.
- Mostrar la antigüedad real disponible de la tasa local. El estado de
  sincronización y antigüedad distribuida sigue perteneciendo a Fase 10.

## Secuencia outside-in

1. Cerrar y documentar las seis decisiones pendientes, en especial proveedor,
   vigencia, alcance del histórico y autorización de sugerencias.
2. Escribir pruebas de aplicación fallidas para histórico, sugerencia válida y
   fallos controlados; comprobar que ninguna lectura persiste datos.
3. Implementar el puerto de histórico y adapter Drizzle con orden y filtros
   deterministas sobre SQLite temporal.
4. Publicar contratos shared y pruebas HTTP de vigente, histórico, sugerencia,
   sesión, permiso de escritura, idempotencia y Problem Details.
5. Implementar el driver aprobado con transporte simulado, timeout, validación
   y redacción de secretos; componerlo solo en el servidor.
6. Ampliar el cliente desktop y el recorrido E2E para carga manual,
   confirmar/rechazar sugerencia y operación offline.
7. Implementar la pantalla con el shell y CSS existentes, sin design system ni
   estado global especulativo.
8. Ejecutar pipeline y build; actualizar 9.07, el README de Fase 9 y el índice
   maestro solo cuando todos los criterios estén verificados.

## Criterios de aceptación

- [ ] La tasa vigente y el histórico proceden de SQLite local mediante queries
  de aplicación y contratos compartidos, no de datos mock ni SQL en rutas.
- [ ] Cada tasa visible conserva par, entero escalado, escala, fuente y vigencia
  sin usar `float` para transportar, calcular o confirmar el valor.
- [ ] Solicitar, refrescar, rechazar o fallar una sugerencia produce cero
  escrituras en `exchange_rates`, auditoría, ledger e idempotencia.
- [ ] La sugerencia nunca se muestra como vigente, oficial o aplicada y no se
  confirma sin una acción humana explícita.
- [ ] Confirmar usa exclusivamente `UpdateExchangeRate`, exige motivo,
  idempotencia y `currency.rate.update`, y crea una entrada histórica auditable.
- [ ] Un replay con la misma intención devuelve el mismo resultado y un payload
  distinto con la misma clave produce `IDEMPOTENCY_KEY_CONFLICT`.
- [ ] Timeout, red caída, respuesta inválida y par no soportado producen códigos
  seguros; ninguno oculta ni invalida la última tasa local vigente.
- [ ] Sin conexión externa se puede consultar la tasa local y completar una
  carga manual autorizada.
- [ ] Ninguna credencial, body externo crudo o dato excluido aparece en logs,
  Problem Details o renderer.
- [ ] E2E cubre tasa vigente, histórico, carga manual, confirmación, rechazo,
  denegación y fallo offline de la sugerencia.
- [ ] Lint, typecheck, tests y build quedan verdes.

## Fuera de alcance

- Aplicar automáticamente una tasa sugerida o programar actualizaciones en
  segundo plano.
- Sincronizar tasas entre nodos, mostrar estado distribuido o resolver
  conflictos de versiones; pertenece a Fase 10.
- Elegir una fuente regulatoria sin evidencia primaria y aprobación del negocio.
- Promedios, arbitraje entre proveedores, predicción, alertas o gráficos.
- Introducir secretos en renderer, Electron IPC o archivos versionados.
