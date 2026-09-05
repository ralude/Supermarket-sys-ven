# Plan de ejecución 9B.12: Arqueos y autorizaciones

- **Sub-fase:** [9B.12 Arqueos y autorizaciones](./9b.12-arqueos-y-autorizaciones.md)
- **Estado del plan:** Listo para implementación incremental
- **Decisión:** el turno cerrado permanece inmutable; la reapertura queda fuera del MVP.

## Resultado esperado

El jefe de cajas consulta turnos propios y ajenos con permiso, presenta esperado, declarado y
diferencia por método y moneda, y revisa anulaciones con la historia de la venta.

## Línea base comprobada

- `CloseShift` ya calcula y persiste diferencias en `shift_closing_balances`.
- `GetSaleHistory` existe, está exportado y necesita una ruta con autorización explícita.
- No existe transición `Shift.reopen`, por lo que no se añade una para resolver una regla fiscal
  que el MVP no pretende certificar.

## Default de referencia

- `cash.shift.read.any` permite consultar turnos ajenos y cerrados con límite de filas.
- `GetSaleHistory` exige un permiso de lectura de auditoría en el caso de uso.
- Un turno cerrado no admite movimientos nuevos ni edición. Una corrección posterior usa un
  nuevo turno o ajuste auditado.
- El renderer presenta los saldos persistidos; no recalcula negocio.

## Secuencia outside-in

1. Probar lectura autorizada y denegada de turnos ajenos y cerrados.
2. Publicar la historia de venta con autorización en aplicación.
3. Probar arqueo por método y moneda, incluyendo diferencias.
4. Probar que un turno cerrado rechaza nuevas operaciones y conserva su arqueo.
5. Publicar rutas y pantalla con controles derivados de permisos efectivos.

## Criterios de aceptación

- [ ] Consultar un turno ajeno exige `cash.shift.read.any`.
- [ ] La historia de venta no queda publicada sin autorización.
- [ ] El arqueo se presenta sin cálculo en el renderer.
- [ ] Un turno cerrado permanece inmutable y su diferencia sigue consultable.
- [ ] Cada lectura sensible respeta límite y auditoría de acceso.
- [ ] `pnpm test`, `pnpm typecheck` y `pnpm lint` quedan verdes.

## Fuera de alcance

- Reapertura de turnos y cualquier reversión de un reporte Z.
- Devoluciones y notas de crédito, que pertenecen a 9B.06.
- Sincronización de turnos entre nodos.
