# Plan de ejecución 9B.10: Configuración operativa

- **Sub-fase:** [9B.10 Configuración operativa](./9b.10-configuracion-operativa.md)
- **Estado del plan:** Listo para implementación incremental
- **Decisión:** [ADR-0021](../../architecture/adr/0021-mvp-referencia-no-certificado.md) permite
  defaults de referencia sin catálogo fiscal hipotético.

## Resultado esperado

Administrar desde la interfaz los maestros que ya existen —métodos de pago, categorías,
unidades y políticas operativas— sin reescribir hechos históricos.

## Línea base comprobada

- Los repositorios de lectura de categorías, unidades, métodos de pago y cajas ya existen.
- IGTF y descuento máximo ya usan políticas versionadas.
- IVA vive como `taxRateBasisPoints` en `Product`; no existe un catálogo global de alícuotas.
- 9B.02 ya publica las lecturas de datos maestros.

## Default de referencia

- La tasa IVA permanece en el producto; no se migra a categorías de alícuotas.
- `quantityScale` queda inmutable después del primer uso.
- Las categorías y unidades reutilizan un permiso de catálogo existente o un único permiso
  mínimo, sin crear una jerarquía nueva de roles.
- Un cambio de política publica una versión nueva; nunca muta la vigente.
- Desactivar un maestro conserva la fila y su historia, y solo bloquea nuevas operaciones.

## Secuencia outside-in

1. Probar alta, edición y cambio de estado de los maestros existentes con autorización e
   idempotencia.
2. Probar que una política nueva desactiva la anterior y conserva su histórico.
3. Probar que una configuración nueva no altera ventas ni documentos ya emitidos.
4. Probar rechazo de `quantityScale` después de que la unidad tenga historia.
5. Probar auditoría con actor, terminal, nodo, UTC, motivo y valores antes/después.
6. Publicar los contratos HTTP y la pantalla con controles derivados de permisos efectivos.

## Criterios de aceptación

- [ ] Los maestros existentes se administran desde la interfaz con permisos de caso de uso.
- [ ] Las políticas versionadas conservan su historial.
- [ ] No existe borrado físico de un maestro con historia.
- [ ] Los cambios sensibles dejan auditoría y no reescriben hechos.
- [ ] El catálogo futuro de alícuotas no es requisito de salida.
- [ ] `pnpm test`, `pnpm typecheck` y `pnpm lint` quedan verdes.

## Fuera de alcance

- Catálogo general de alícuotas y taxonomía fiscal por país.
- Administración de identidad, cajas y dispositivos.
- Distribución de datos de referencia entre nodos.
