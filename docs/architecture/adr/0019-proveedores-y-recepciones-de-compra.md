# ADR-0019: Proveedores y evidencia de recepciones de compra

- Estado: Aceptado para el corte 9B.03; decisiones documentales diferidas a 9B.04
- Fecha: 2026-09-04

## Contexto

La sub-fase 9B.03 debe convertir al proveedor en una entidad persistida y dejar
de aceptar un `supplierId` opaco sin validación. Las reglas de negocio aprobadas
exigen identidad fiscal única, estados operativos, auditoría de cambios
sensibles, conservación histórica y un snapshot del proveedor en cada recepción
completada.

La arquitectura vigente presenta dos contradicciones:

1. `docs/cronograma/fase-09b-perfiles/9b.03-proveedores.md` exige un agregado
   `Supplier`, pero `05-agregados.md` solo reconoce `PurchaseOrder` como raíz del
   módulo `purchasing`.
2. La recepción actual no es una entidad ni un agregado. `ReceivePurchase`
   registra directamente un movimiento de `StockItem` y usa `receiptId` como
   referencia externa, por lo que no existe un lugar durable donde sellar el
   snapshot del proveedor, el documento de origen o el estado `COMPLETED`.

Además, la regla aprobada indica que una recepción completada conserva costos
inmutables. El costo y su método de valoración pertenecen expresamente a 9B.04,
que está bloqueada por ADR-0016 y no puede adelantarse mientras 9B.03 esté
abierta. Crear en 9B.03 una recepción `COMPLETED` sin costo incumpliría la regla;
agregar el costo después mutaría evidencia ya completada.

## Decisiones de negocio ya aprobadas

- `Supplier` tiene un ID técnico inmutable y un código humano generado por
  Cullen, independiente de su identidad fiscal.
- La identidad fiscal se compone de país, tipo, valor capturado y valor
  normalizado. La unicidad usa `(country, type, normalizedValue)`.
- Los estados son `ACTIVE`, `BLOCKED` e `INACTIVE`; solo `ACTIVE` puede usarse
  en una nueva recepción.
- No existe borrado físico de un proveedor con historia.
- Los cambios sensibles generan auditoría de negocio con actor, UTC, campo,
  valor anterior, valor nuevo y motivo cuando corresponda.
- La identidad fiscal de un proveedor con recepciones completadas solo puede
  corregirse para la misma entidad legal mediante permiso privilegiado, motivo
  y auditoría. Un contribuyente distinto requiere otro proveedor.
- Una recepción completada conserva un snapshot inmutable del proveedor y de
  su documento de origen; editar el maestro no reescribe historia.

## Decisión arquitectónica

### Fronteras de agregado

`Supplier` pasa a ser raíz de agregado del módulo `purchasing`. Protege su
identidad, código, estado y reglas de edición. El repositorio garantiza la
unicidad fiscal dentro de la misma transacción y permite consultar si existe
historia completada antes de corregir la identidad.

`PurchaseReceipt` será una raíz separada del mismo módulo cuando se implemente
el documento completo. Contendrá su ID técnico, proveedor, snapshot, documento
de origen, líneas y estado. `StockItem` seguirá siendo la raíz de inventario;
ningún agregado modificará internamente al otro.

El caso de uso de recepción coordinará las raíces mediante puertos y una sola
`UnitOfWork`: o se confirma toda la evidencia y el movimiento de inventario, o
no se confirma nada. La idempotencia existente se conserva. Cuando el producto
todavía no tenga `StockItem`, su ID lo genera la aplicación; nunca el renderer.

### Separación entre 9B.03 y 9B.04

Para no adelantar costos ni crear recepciones históricamente incompletas, 9B.03
implementaría únicamente el maestro `Supplier`, su auditoría, sus consultas y
la validación de que el proveedor referenciado por la recepción actual existe y
está `ACTIVE`. El documento durable `PurchaseReceipt`, el snapshot completo y
su transición a `COMPLETED` entrarían en 9B.04 junto con el costo aprobado por
ADR-0016.

Mientras tanto, 9B.03 no presentará el `receiptId` actual como una recepción
persistida ni permitirá editar evidencia histórica: seguirá siendo solo la
referencia del movimiento ya existente. Esta separación es la opción mínima
que respeta el orden de fases y no inventa un costo.

### Identificadores y códigos

El ID técnico usa el generador de aplicación aprobado por ADR-0003. El código
humano sigue el formato `SUP-000001`, es inmutable y se asigna
transaccionalmente. En Fase 9B su unicidad solo puede garantizarse dentro del
nodo dueño; la autoridad y reconciliación multi-nodo pertenecen a Fase 10.

El número del documento del proveedor nunca se reutiliza como ID técnico de la
recepción. Cuando exista `PurchaseReceipt`, el documento de origen conservará
`type`, `number`, `controlNumber?`, `issuedAt?` y `currency?`.

### Auditoría y protección de datos

La evidencia de cambios sensibles se escribe en `audit_log`, no en logs
técnicos. Los resúmenes antes/después pueden contener datos fiscales y quedan
protegidos por la política de auditoría; la lectura operativa de ADR-0013 no los
proyecta. Los logs técnicos solo usan IDs y códigos de error.

### Normalización disponible en 9B.03

La identidad mínima de alta normaliza país y tipo a mayúsculas. Para `VE/RIF`
normaliza Unicode, mayúsculas, espacios y guiones, y valida estructuralmente
`^[VEJPGC][0-9]{9}$`; no afirma comprobar el dígito tributario. Para otros
pares conserva la puntuación después de normalizar Unicode, mayúsculas y
espacios exteriores. La validación tributaria específica se exige antes de
completar una recepción y queda en el corte documental de 9B.04.

El código `SUP-000001` es único dentro del nodo durante 9B. La autoridad global
y los conflictos entre nodos siguen diferidos a Fase 10.

## Decisiones diferidas antes de completar `PurchaseReceipt` en 9B.04

1. **Validez fiscal por país/tipo.** Definir la matriz de países y tipos
   soportados inicialmente, el algoritmo de normalización y qué significa
   "válida" para cada par. La equivalencia venezolana por mayúsculas, espacios
   y guiones está decidida, pero no el formato ni checksum aceptado.
2. **Dirección fiscal obligatoria.** Definir qué operación o tipo de documento
   la exige. La UI no puede decidir esta regla.
3. **Documento de origen.** Definir los valores permitidos para `type` y si la
   combinación proveedor/tipo/número debe ser única.
4. **Corrección de recepciones.** Definir estados, permiso, efecto de inventario
   y vínculo entre reverso y documento corregido. Hasta entonces no se publica
   ningún comando de edición, borrado, cancelación o reverso.
## Consecuencias

- `Supplier` deja de ser texto libre y obtiene una frontera de consistencia
  explícita sin acoplar inventario a tablas de compras.
- 9B.03 puede cerrarse sin invadir el método de costeo de 9B.04.
- La recepción completa y su snapshot quedan deliberadamente pendientes hasta
  que puedan sellarse con costos, no como una garantía parcialmente cumplida.
- Deben actualizarse `04-entidades.md`, `05-agregados.md` y
  `06-casos-de-uso.md` al aceptar el ADR, antes de escribir código.
- La futura recepción requiere una prueba transaccional de rollback para evitar
  documento sin movimiento o movimiento sin documento.
