# Gap del contrato fiscal antes de codificar protocolos

- **Última revisión:** 2026-08-31
- **Alcance:** inventario técnico de entrada a 8.00; no es interpretación
  tributaria ni selección definitiva de campos
- **Código revisado:** `FiscalDocumentContent`, ventas, repositorios y migración
  fiscal 0009
- **Fuentes externas:** [registro de fuentes](./fuentes-oficiales.md)

## Regla de diseño

El caso de uso debe entregar al driver un snapshot fiscal completo e inmutable.
El driver solo valida límites y traduce ese snapshot al protocolo seleccionado;
no consulta clientes, ventas, tasas ni configuración tributaria por una vía
lateral, y nunca inventa un dato obligatorio.

No se agregan campos al modelo por el solo hecho de aparecer en un manual. La
semántica se confirma con PNP, HKA/ACLAS y asesoría; los límites físicos viven en
el manifiesto de cada adaptador, mientras los hechos de negocio necesarios para
emitir y auditar pertenecen al contrato común.

## Estado actual aprovechable

`FiscalDocumentContent` ya conserva referencia local, tipo factura/nota de
crédito, moneda del documento, líneas, pagos y total. Cada línea contiene
descripción, cantidad escalada, escala, precio unitario, tasa y total. El flujo
persiste el contenido antes de invocar la impresora y lo mantiene inmutable.

El agregado `Sale` dispone de más información que el snapshot fiscal actual:
subtotal, descuento, base imponible, impuesto, IGTF, pagos en moneda original,
monto convertido y `ExchangeRate` con fuente y vigencia. Esa información se
pierde al construir el payload fiscal; no debe recuperarse luego desde tablas de
ventas.

## Gaps confirmados por el protocolo PNP publicado

### Comprador

El comando PNP 0x40 publicado incluye razón social y RIF del comprador. El
contrato actual no representa identidad fiscal del comprador ni distingue
consumidor no identificado de dato obligatorio ausente. Debe definirse un
snapshot de comprador con reglas de presencia, tipo y normalización confirmadas
por normativa y por ambos perfiles.

### Nota de crédito

El mismo comando PNP solicita número, serial de máquina, fecha y hora de la
factura objeto de devolución. El contrato solo cambia `type` a `CREDIT_NOTE` y
no conserva el vínculo fiscal con el original. Una nota no puede emitirse hasta
persistir esos datos originales y validar que corresponden al documento
inmutable corregido.

### Líneas, impuestos y redondeo

El modelo conserva cantidad, precio y tasa, pero no congela por línea base
imponible, descuento, impuesto calculado, calificador fiscal ni política de
redondeo. El adaptador tampoco debe recalcular resultados comerciales con una
aritmética distinta a ventas. Se deben confirmar escalas, longitudes, rangos y
representación de exento/percibido para cada perfil.

### Totales e IGTF

El snapshot solo persiste el total general. Ventas ya calcula subtotal,
descuentos, base, IVA e IGTF por separado. El cierre PNP publicado recibe un
monto de pago en divisa y devuelve el IGTF agregado, pero su texto incluye una
alícuota histórica que no se adopta como regla. El contrato debe congelar el
desglose y la política aplicada; tasa, sujetos, exenciones y vigencia provienen
de configuración auditable y revisión tributaria.

### Pagos y moneda

Cada pago fiscal actual conserva únicamente método y monto, sin código de
moneda, monto en moneda original, equivalente en moneda de la venta ni snapshot
de la tasa. `Payment` ya posee esos datos. Deben trasladarse de forma inmutable
con ID, valor, escala, fuente y vigencia de la tasa cuando exista conversión.

### Confirmación y recuperación

El cierre PNP publicado devuelve estado, contador de facturas, número emitido,
contador de notas e IGTF. `Status_IF` publica contadores y último Z para los
modelos enumerados. El puerto actual solo expone la última referencia local y
el número de documento, una capacidad propia del fake que el equipo podría no
conocer después de reiniciar. La reconciliación requiere snapshots previos y
posteriores de contadores/estado definidos por cada adaptador, sin inferir
`NOT_ISSUED` por ausencia de la referencia local.

## Gaps pendientes de fuente HKA/ACLAS

El brochure PP9-PLUS confirma capacidades comerciales e interfaces. El manual
oficial APP HKA POS v1.01.3 muestra consultas operativas `STATUS S1` a `S4`,
acumulados y cierre Z, pero no define framing, firmas de SDK, códigos de retorno,
atomicidad ni qué consulta constituye evidencia autoritativa después de una
respuesta perdida. Hasta recibir el protocolo o SDK venezolano no se puede
afirmar que el conjunto PNP sea suficiente, fijar longitudes ni convertir
comandos PNP o nombres de pantalla HKA en contrato común.
Toda diferencia se resolverá con mapeadores de adaptador salvo que revele un
hecho fiscal que el caso de uso realmente deba proporcionar.

## Datos que no pertenecen al documento

Serial fiscal, RIF del emisor, autorización, firmware, perfil, interfaz y DCTD
pertenecen a identidad/configuración del dispositivo y al manifiesto soportado.
Se registran como evidencia del intento y de la instalación, no se aceptan desde
la UI dentro de cada factura.

## Pruebas outside-in necesarias antes del cambio de modelo

- Rechazar factura cuando falte un dato de comprador que la política vigente
  marque obligatorio; permitir el caso anónimo únicamente bajo una regla
  explícita y probada.
- Rechazar nota de crédito sin número, serial, fecha y hora del original, y
  conservar el vínculo después de reabrir SQLite.
- Persistir y rehidratar subtotal, descuentos, bases, impuestos, IGTF y política
  de redondeo sin usar `float`.
- Persistir por pago moneda/monto original, equivalente y tasa completa; exigir
  ausencia de tasa solo cuando no hubo conversión.
- Probar límites mediante capacidades del manifiesto sin introducir PNP o HKA
  en dominio.
- Confirmar que el adaptador recibe un snapshot suficiente y no consulta
  repositorios de ventas/clientes/configuración.
- Probar migración forward-only desde la versión 0009 y preservar documentos ya
  emitidos o recuperables.

## Decisiones abiertas que bloquean la implementación

- Reglas vigentes y umbrales de identificación del comprador.
- Fuente canónica de datos de cliente sin adelantar el módulo `customers` fuera
  de alcance; puede requerirse un snapshot de entrada mínimo.
- Semántica y documentos originales permitidos para notas de crédito/débito.
- Desglose requerido en moneda de operación y moneda de curso legal.
- Política IGTF vigente y su trazabilidad por pago.
- Límites y capacidades exactos del firmware PNP seleccionado.
- Campos y recuperación exigidos por el protocolo/SDK HKA.

Mientras estas decisiones no tengan evidencia, el modelo actual no se conecta a
un encoder real. El fake continúa sirviendo para orquestación, no para afirmar
que el payload está listo para una máquina fiscal.
