# Fase 9: UI

- **Estado:** En curso (sub-fase 9.07; 9.00–9.06 completadas)
- **Indice:** [Cronograma](../README.md)
- **Replanificacion:** [Suspension de Fase 8 y avance a Fase 9](../replanificacion-fase-08-a-09.md)

## Proposito

Construir la interfaz React y su integracion con el negocio a traves de HTTP.

## Sub-fases

- [~~9.00 API HTTP y composicion~~](./9.00-api-http.md)
- [~~9.01 Base React~~](./9.01-base-react.md)
- [~~9.02 Pantalla de venta~~](./9.02-pantalla-venta.md)
- [~~9.03 Pantalla de caja~~](./9.03-pantalla-caja.md)
- [~~9.04 Pantalla de catalogo~~](./9.04-pantalla-catalogo.md)
- [~~9.05 Pantalla de inventario~~](./9.05-pantalla-inventario.md)
- [~~9.06 Reportes y cierres~~](./9.06-pantalla-reportes.md)
- [9.07 Tasas de cambio](./9.07-tasas-de-cambio.md)

## Restriccion

El renderer no accede directamente a Node.js, SQLite, serial ports ni secretos.

Antes de 9.00 debe completarse el [gate de seguridad antes de UI operativa](../gate-seguridad-pre-ui.md). Las pantallas no crean endpoints ad hoc; consumen los contratos publicados en 9.00.

Mientras la Fase 8 permanezca suspendida, la composición usa exclusivamente
`FiscalPrinterFake`; toda capacidad fiscal visible se rotula como simulación y
ninguna pantalla declara emisión fiscal real, compatibilidad de hardware ni
habilitación para piloto. No se incorporan SerialPort, protocolos o SDK de
proveedor como parte de la UI.

## Orden de entrada

1. Completar el corte mínimo de 11.01–11.03 del gate de seguridad pre-UI.
2. Ejecutar 9.00 y publicar la API HTTP autenticada.
3. Continuar 9.01–9.07 en el orden documentado.

## Disciplina de diseño visual

A partir de 9.01, el trabajo visible aplica Ponytail en intensidad `full`: se
inspecciona y reutiliza primero el shell existente, se prefieren HTML semántico,
controles nativos y CSS antes que JavaScript o dependencias, y no se crea un
design system, librería de componentes o abstracción para necesidades todavía
hipotéticas. Esta simplificación nunca elimina validación, estados de
carga/error, accesibilidad básica ni claridad del modo fiscal `SIMULACION`.

Ponytail no se aplica a la API, seguridad, dominio, persistencia ni pruebas de
9.00; esas superficies siguen sus especificaciones y ADR correspondientes.

## Criterio de salida

Los flujos principales se pueden operar desde la UI y tienen pruebas E2E.
