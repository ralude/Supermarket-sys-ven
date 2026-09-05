# Plan de ejecución 9B.13: KPIs de gerencia

- **Sub-fase:** [9B.13 KPIs de gerencia](./9b.13-kpis-de-gerencia.md)
- **Estado del plan:** Listo para implementación incremental
- **Decisiones:** [ADR-0013](../../architecture/adr/0013-reportes-operativos-de-lectura.md),
  [ADR-0016](../../architecture/adr/0016-metodo-de-costeo-y-margen.md) y
  [ADR-0021](../../architecture/adr/0021-mvp-referencia-no-certificado.md)
- **Disciplina:** Outside-in TDD (ADR-0007) y Ponytail `full`

## Resultado esperado

Publicar un resumen acotado de ventas completadas e inventario del nodo. Al concluir 9B.04,
añadir costo de ventas y margen. Cada cifra declara período, moneda y alcance; React no
recalcula reglas de negocio.

## Línea base comprobada

- Los reportes actuales cubren cierres, auditoría y fiscalidad con permisos, límites 100/500 y
  exportación CSV local.
- No existen `reports.sales.read`, `reports.inventory.read` ni `reports.margin.read`.
- Venta, stock, movimientos y lotes ya son relacionales; el margen no es fiable hasta que
  9B.04 persista costos de salida.
- No hay librería de gráficos ni hace falta añadirla para entregar las lecturas.

## Contrato mínimo de indicadores

- **Ventas:** cantidad de ventas `COMPLETED`, cantidad de líneas y total vendido por moneda en
  un período UTC. No se suman cantidades de unidades o escalas distintas. Ventas `DRAFT` y
  `VOIDED` no cuentan.
- **Inventario:** existencia actual por producto/lote, productos sin existencia y lotes
  vencidos o próximos a vencer según una fecha de corte explícita.
- **Margen, después de 9B.04:** ingreso neto, costo de ventas y margen absoluto por moneda. No
  se publica porcentaje cuando el denominador es cero.
- **Devoluciones, después de 9B.06:** se muestran por separado con cantidad e importe y permiten
  derivar venta neta; revierten costo usando sus snapshots. Hasta entonces la respuesta declara
  que no las incorpora.

No se denomina “rotación” a ninguna cifra en este corte: su fórmula, ventana y denominador no
están especificados. Agregarla exige criterios de aceptación propios, no bloquea estos KPIs.

## Decisiones de frontera

- Se añaden casos de uso de lectura y puertos especializados, no acceso SQL desde rutas ni un
  motor genérico de reportes.
- Ventas exige `reports.sales.read`, inventario `reports.inventory.read` y margen
  `reports.margin.read`; se autoriza antes de consultar.
- Toda consulta recibe período/corte y límite recortado en aplicación. El adaptador puede
  agregar en SQL, pero la semántica y la separación de monedas pertenecen a aplicación.
- La exportación reutiliza el CSV visible de ADR-0013: no vuelve a consultar ni agrega datos.

## Secuencia outside-in

1. Probar cada permiso y demostrar que `FORBIDDEN` no ejecuta el repositorio.
2. Probar ventas con período vacío, límites, estados excluidos y dos monedas separadas.
3. Probar inventario actual con lotes, vencimientos y corte UTC.
4. Publicar contratos, adaptadores SQLite, rutas y tarjetas/listados mínimos.
5. Después de 9B.04, probar costo y margen con snapshots históricos y denominador cero.
6. Después de 9B.06, probar el efecto de una devolución sin reescribir la venta original.
7. Probar exportación desde la proyección visible y neutralización CSV ya existente.
8. Ejecutar verificaciones y actualizar el cronograma en cada entrega incremental.

## Criterios de aceptación

- [ ] Ventas e inventario funcionan independientemente de 9B.04.
- [ ] Cada lectura autoriza en aplicación y siempre consulta con cota.
- [ ] Monedas y períodos son explícitos; no hay conversiones implícitas.
- [ ] Margen solo aparece con costo histórico implementado y autorizado.
- [ ] El renderer presenta los valores recibidos y reutiliza la exportación existente.
- [ ] No se añade dependencia de visualización ni abstracción genérica de BI.
- [ ] `pnpm test`, `pnpm typecheck` y `pnpm lint` quedan verdes.

## Fuera de alcance

- Rotación sin fórmula aprobada, proyecciones, metas, alertas y comparativos multi-sucursal.
- Cubos, data warehouse, dashboards configurables y optimización de Fase 12.
- Consolidación y ownership multi-nodo de Fase 10.
