# Plan de ejecución 9B.03: Proveedores

- **Sub-fase:** [9B.03 Proveedores](./9b.03-proveedores.md)
- **Estado del plan:** Cumplido; ADR-0019 aceptado con las reglas fiscales, documentales y
  de ciclo de vida aprobadas el 2026-09-04
- **Prerrequisito:** [9B.02 Datos maestros seleccionables](./9b.02-datos-maestros-seleccionables.md)
- **Decisión arquitectónica:** [ADR-0019](../../architecture/adr/0019-proveedores-y-recepciones-de-compra.md)
- **Disciplina de implementación:** Outside-in TDD y Ponytail `full`

## Resultado esperado

El proveedor es un maestro de negocio persistido, consultable y auditable. Una
nueva recepción deja de confiar en un identificador escrito a mano: selecciona
un proveedor existente y el servidor comprueba que está `ACTIVE`. La sub-fase
no inventa costos, no presenta una referencia de movimiento como si fuera un
documento de recepción completo y no adelanta sincronización.

## Línea base comprobada

- No existe entidad, agregado, repositorio, tabla ni contrato HTTP de
  proveedores.
- `ReceivePurchase` acepta `supplierId` como cadena y solo lo copia al resumen de
  auditoría; no comprueba existencia, estado ni identidad fiscal.
- La recepción actual no se persiste. `receiptId` es la referencia de un
  movimiento `PURCHASE_RECEIPT`, no un ID de agregado ni el número estructurado
  de un documento del proveedor.
- El contrato pide al renderer `stockItemId`, `unitCode`, `quantityScale` y
  `tracksBatches`. Aunque 9B.02 eliminó parte de la entrada manual, el primer
  recibo de un producto sin kardex sigue siendo imposible porque la aplicación
  no genera el nuevo `StockItem` ni deriva su configuración.
- `05-agregados.md` reconoce `PurchaseOrder`, pero no `Supplier` ni
  `PurchaseReceipt`; el cronograma y las reglas aprobadas sí exigen al primero y
  presuponen al segundo.
- 9B.04 declara que hoy no existe costo de compra y prohíbe elegir un método sin
  ADR-0016. Por eso 9B.03 no puede sellar una recepción `COMPLETED` que, según la
  regla aprobada, debería incluir costos inmutables.
- `audit_log` admite evidencia antes/después, pero ADR-0013 excluye esos
  resúmenes de la lectura operativa. Los logs técnicos prohíben copiar RIF,
  nombres, direcciones, teléfonos y correos.

## Especificación de negocio aprobada

### Identidad y datos mínimos

`Supplier` conserva:

- `id`: ID técnico generado por la aplicación e inmutable;
- `code`: código humano generado por Cullen, con forma `SUP-000001`, inmutable;
- `legalName`;
- `taxIdentity`: `country` (por defecto `VE`), `type`, `value` capturado y
  `normalizedValue` derivado;
- `status`: `ACTIVE` por defecto, además de `BLOCKED` e `INACTIVE`;
- `createdAt` y `updatedAt` obtenidos del reloj de aplicación.

La identidad fiscal no es el ID del proveedor. La creación no exige datos
comerciales accesorios. `tradeName` y `fiscalAddress` pueden capturarse cuando
existan; los demás datos opcionales no se modelan hasta tener una forma y un
consumidor concretos.

### Unicidad y normalización

La clave fiscal única es `(country, type, normalizedValue)`. La normalización
es determinista y ocurre en dominio/aplicación, nunca solo en UI. Para Venezuela
se ha aprobado que diferencias de mayúsculas, espacios y guiones no crean otra
identidad; aún falta aprobar la validación estructural exacta y la matriz para
otros países.

### Estado y ciclo de vida

- Solo un proveedor `ACTIVE` puede seleccionarse para una nueva operación.
- `BLOCKED` e `INACTIVE` permanecen visibles en consultas históricas, reportes y
  auditoría.
- No se publica `DELETE`. El estado sustituye el borrado físico.
- La diferencia operativa adicional entre `BLOCKED` e `INACTIVE`, si se desea
  una más allá de impedir nuevas operaciones, debe especificarse antes de
  implementarla.

### Edición y auditoría

Los cambios ordinarios usan `supplier.update`. Cambios de `legalName`, dirección
fiscal, clasificación/tipo fiscal, datos bancarios o configuración fiscal son
sensibles y generan auditoría con `supplierId`, actor, UTC, campo, valor anterior
y nuevo, y motivo cuando el comando lo requiera.

La corrección de identidad fiscal después de existir una recepción completada
requiere un permiso dedicado propuesto como `supplier.tax_identity.correct`, un
motivo no vacío y auditoría. Solo corrige a la misma entidad legal; cambiar de
contribuyente crea otro `Supplier`. Ningún cambio reescribe snapshots previos.

En 9B.03 no se agregan banca, notas, términos de pago ni direcciones logísticas:
son opcionales, no tienen forma aprobada ni consumidor actual. Esta omisión no
relaja las reglas de auditoría cuando se incorporen.

### Recepción e historia

La regla final aprobada exige que una recepción `COMPLETED` conserve proveedor,
snapshot fiscal/comercial, líneas, cantidades, costos, documento de origen y
fecha efectiva; después es inmutable. El snapshot mínimo del proveedor será
`legalName`, `tradeName?`, país/tipo/valor fiscal y `fiscalAddress?`.

ADR-0019 propone implementar ese documento completo en 9B.04, junto con el
costo, para no crear historia incompleta. En 9B.03 la frontera actual solo
valida que `supplierId` exista y esté `ACTIVE`; no declara que el movimiento sea
el documento durable final.

## Decisiones de frontera propuestas

### Casos de uso

- `CreateSupplier`: genera ID y código, normaliza la identidad, comprueba
  unicidad y crea en `ACTIVE`.
- `UpdateSupplier`: modifica campos ordinarios o sensibles permitidos y escribe
  auditoría cuando corresponde.
- `ChangeSupplierStatus`: transición explícita sin borrado físico.
- `CorrectSupplierTaxIdentity`: permiso privilegiado, motivo y auditoría.
- `GetSupplier` y `ListSuppliers`: requieren sesión válida; el listado admite
  filtro de estado. El selector de recepción solicita solo `ACTIVE`.
- `ReceivePurchase`: conserva su permiso e idempotencia, pero carga el proveedor
  mediante puerto y rechaza inexistentes o no activos antes de cualquier
  movimiento.

No se crea un CRUD genérico ni un endpoint de borrado.

### Persistencia y transacción

- Tabla `suppliers` con ID técnico, código humano único, columnas fiscales,
  estado, campos mínimos aprobados, timestamps y versión para concurrencia.
- Índice único sobre país, tipo y valor fiscal normalizado.
- Asignación del código humano dentro de la transacción para evitar duplicados
  en el nodo.
- Repositorio por agregado y migración forward-only con prueba sobre base
  temporal.
- Guardado de agregado, evento, outbox, auditoría e idempotencia en la misma
  `UnitOfWork` cuando correspondan.

### Contratos y UI

Los contratos compartidos publican alta, actualización, corrección fiscal,
cambio de estado, detalle y listado. Los comandos declaran su permiso e
idempotencia; las lecturas solo exigen sesión verificada.

La pantalla de proveedores permite listar, crear y editar dentro de los permisos
efectivos. La recepción reemplaza el campo libre `supplierId` por un selector de
proveedores `ACTIVE`. Ocultar controles no sustituye la autorización del caso de
uso.

## Decisiones diferidas al corte documental de 9B.04

1. Aprobar la matriz inicial de país/tipo y la validación fiscal exacta. Falta
   decidir formato/checksum venezolano y reglas para identidades no venezolanas.
2. Definir cuándo la dirección fiscal es obligatoria y cuál es su representación
   mínima. La aplicación debe poder evaluar la regla sin delegarla a la UI.
3. Definir los tipos y la unicidad del documento de origen antes de persistir
   `PurchaseReceipt`.
4. Definir el flujo de reverso/corrección de una recepción y su efecto en
   inventario antes de publicar esa capacidad.
## Secuencia outside-in

1. Probar contratos HTTP de alta/listado/edición/estado y sus permisos.
2. Probar creación mínima, código generado, normalización y conflicto fiscal.
3. Probar transiciones de estado, ausencia de borrado y visibilidad histórica.
4. Probar auditoría de cada campo sensible y corrección fiscal privilegiada.
5. Probar que una recepción rechaza proveedor inexistente, `BLOCKED` o
   `INACTIVE` sin crear movimiento, ledger, outbox ni auditoría parcial.
6. Probar que el selector solo ofrece `ACTIVE` y que la UI no envía un ID libre.
7. Implementar dominio, aplicación, puertos y fakes hasta satisfacer las pruebas.
8. Agregar migración y repositorio Drizzle; verificar unicidad, concurrencia,
   rollback y rehidratación.
9. Publicar contratos/rutas y conectar la pantalla de proveedores y el selector.
10. Ejecutar `pnpm test`, `pnpm typecheck`, `pnpm lint` y actualizar el cronograma.

## Criterios de aceptación de 9B.03

- [x] `Supplier` es raíz de agregado aceptada en ADR y documentada en
  arquitectura antes de implementar.
- [x] Alta genera ID técnico y código humano inmutables; el cliente no los elige.
- [x] La identidad fiscal es única por país/tipo/valor normalizado y sus reglas
  aprobadas están cubiertas por pruebas.
- [x] Crear exige solo la identidad mínima aprobada; no se inventan campos
  fiscales o comerciales obligatorios.
- [x] `ACTIVE`, `BLOCKED` e `INACTIVE` se conservan; no existe borrado físico ni
  endpoint `DELETE`.
- [x] Las lecturas requieren sesión válida, permiten historia y el selector de
  nueva recepción devuelve solo proveedores `ACTIVE`.
- [x] Cada cambio sensible y cada corrección privilegiada guarda la evidencia de
  auditoría aprobada sin copiar PII a logs técnicos.
- [x] `ReceivePurchase` rechaza proveedor inexistente o no activo antes de crear
  cualquier efecto durable.
- [x] La UI administra proveedores según permisos efectivos y no pide escribir
  `supplierId`.
- [x] La recepción de un producto sin `StockItem` deja de depender de un ID
  generado por el renderer; la aplicación genera y deriva la configuración.
- [x] No se agrega costo, margen, valoración, sincronización ni un falso
  `PurchaseReceipt COMPLETED` sin costo.
- [x] `pnpm test`, `pnpm typecheck` y `pnpm lint` quedan verdes.

## Criterios reservados para 9B.04

- Persistir `PurchaseReceipt`, documento de origen, fecha efectiva, líneas,
  cantidades y costos.
- Sellar el snapshot inmutable del proveedor al completar.
- Confirmar recepción y movimientos de inventario en una sola transacción.
- Mantener los snapshots históricos ante ediciones posteriores del proveedor.
- Implementar corrección/reverso solo después de aprobar su semántica.

## Fuera de alcance

- Método de costeo, valoración y margen: 9B.04 y ADR-0016.
- Clientes e identidad fiscal de ventas: 9B.05 y ADR-0018.
- Devoluciones de clientes y notas de crédito: 9B.06 y ADR-0017.
- Sincronización, asignación global de códigos y conflictos multi-nodo: Fase 10.
- Banca, notas, términos de pago y datos logísticos sin consumidor ni forma
  aprobada.
