# Disposición de decisiones de Fase 9B

- **Estado:** Reemplazado como gate global por [ADR-0021](../../architecture/adr/0021-mvp-referencia-no-certificado.md)
- **Fecha:** 2026-09-04
- **Uso:** registro de alcance y diferimientos; no bloquea el MVP técnico.

## Regla de avance

La fiscalidad del MVP es `SIMULACION` y no certificada. Las decisiones de arquitectura y las
invariantes de datos siguen siendo obligatorias; una validación legal, contable o de fabricante
solo bloquea el perfil certificado, el driver real y el piloto.

## Disposición

| Decisión | Tratamiento del MVP | Sub-fase |
| --- | --- | --- |
| Costeo | Promedio ponderado móvil, costo congelado y reemplazable | 9B.04 |
| Cliente | Snapshot opcional por venta; sin maestro `Customer` | 9B.05 |
| Devolución | Flujo total contra venta original, nota fake y sin reapertura | 9B.06 |
| Almacenes | Un almacén implícito por nodo; transferencia diferida | 9B.08 |
| Configuración | Maestros existentes y políticas versionadas; sin catálogo IVA nuevo | 9B.10 |
| Caja | Arqueo, lecturas e historia; turno cerrado inmutable | 9B.12 |

## Lo que continúa siendo un gate real

- Reanudar Fase 8 con evidencia de proveedor, modelo, firmware, protocolo y recuperación.
- Validar las obligaciones fiscales del despliegue con responsables profesionales antes del
  piloto o producción.
- Mantener `SIMULACION` visible mientras no exista un driver calificado.

## Mantenimiento

Si un consumidor real contradice un default, se abre un ADR o una especificación de negocio que
cambie explícitamente el alcance. No se reintroduce este archivo como bloqueo transversal ni se
duplican aquí los criterios de los ADR.
