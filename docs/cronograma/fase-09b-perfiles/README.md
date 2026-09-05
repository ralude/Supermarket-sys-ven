# Fase 9B: Perfiles operativos y capacidades faltantes

- **Estado:** En progreso
- **Índice:** [Cronograma](../README.md)
- **Replanificación:** [Inserción de Fase 9B antes de Fase 10](../replanificacion-fase-09b.md)
- **Política de alcance:** [ADR-0021, MVP de referencia no certificado](../../architecture/adr/0021-mvp-referencia-no-certificado.md)

## Propósito

Reorganizar la interfaz alrededor de los perfiles que operan un supermercado y completar las
capacidades que esos perfiles necesitan. La Fase 9B entrega una referencia funcional; no
certifica obligaciones fiscales ni compatibilidad de hardware.

La creación de operadores y roles pertenece a [11.02](../fase-11-seguridad/11.02-roles-permisos.md).
Esta fase consume los permisos que la sesión declara y no administra identidad.

## Sub-fases

### Fundación

- [~~9B.00 Permisos efectivos en la sesión~~](./9b.00-permisos-en-sesion.md)
- [~~9B.01 Reestructuración del renderer~~](./9b.01-reestructuracion-renderer.md)
- [~~9B.02 Datos maestros seleccionables~~](./9b.02-datos-maestros-seleccionables.md)

### Capacidades de negocio

- [~~9B.03 Proveedores~~](./9b.03-proveedores.md)
- [~~9B.04 Costo de compra y margen~~](./9b.04-costo-y-margen.md)
- [~~9B.05 Clientes e identificación fiscal~~](./9b.05-clientes.md) — snapshot opcional
- [~~9B.06 Devoluciones y notas de crédito~~](./9b.06-devoluciones.md) — alcance mínimo fake
- [~~9B.07 Conteos físicos~~](./9b.07-conteos-fisicos.md)
- [9B.08 Transferencias de existencia](./9b.08-transferencias.md) — **diferida**
- [9B.09 Usuarios, roles y permisos](./9b.09-usuarios-y-roles.md) — **retirada**, trasladada a
  [11.02](../fase-11-seguridad/11.02-roles-permisos.md)
- [9B.10 Configuración operativa](./9b.10-configuracion-operativa.md) — lista, alcance recortado
- [~~9B.11 Sucursales y dispositivos~~](./9b.11-sucursales-y-dispositivos.md)
- [9B.12 Arqueos y autorizaciones](./9b.12-arqueos-y-autorizaciones.md) — sin reapertura
- [9B.13 KPIs de gerencia](./9b.13-kpis-de-gerencia.md) — incremental

### Perfiles

- [9B.14 Perfil Cajero](./9b.14-perfil-cajero.md) — composición incremental
- [9B.15 Perfil Jefe de cajas](./9b.15-perfil-supervisor.md) — composición incremental
- [9B.16 Perfil Inventario](./9b.16-perfil-inventario.md) — sin transferencias
- [9B.17 Perfil Administrador](./9b.17-perfil-administrador.md) — composición incremental
- [9B.18 Perfil Gerencia](./9b.18-perfil-gerencia.md) — composición incremental con el margen
  de 9B.04 ya disponible

## Planes de ejecución

Todas las sub-fases activas tienen un plan. Los planes completados se conservan como evidencia
de ejecución; los pendientes fijan línea base, fronteras, secuencia outside-in, criterios y
fuera de alcance.

- Fundación y capacidades completadas: [9B.00](./plan-9b.00-permisos-en-sesion.md),
  [9B.01](./plan-9b.01-reestructuracion-renderer.md),
  [9B.02](./plan-9b.02-datos-maestros-seleccionables.md),
  [9B.03](./plan-9b.03-proveedores.md), [9B.04](./plan-9b.04-costo-y-margen.md),
  [9B.05](./plan-9b.05-clientes.md), [9B.07](./plan-9b.07-conteos-fisicos.md) y
  [9B.11](./plan-9b.11-sucursales-y-dispositivos.md).
- Capacidades listas: [~~9B.06~~](./plan-9b.06-devoluciones.md),
  [9B.10](./plan-9b.10-configuracion-operativa.md),
  [9B.12](./plan-9b.12-arqueos-y-autorizaciones.md) y
  [9B.13](./plan-9b.13-kpis-de-gerencia.md).
- Perfiles: [9B.14](./plan-9b.14-perfil-cajero.md),
  [9B.15](./plan-9b.15-perfil-supervisor.md),
  [9B.16](./plan-9b.16-perfil-inventario.md),
  [9B.17](./plan-9b.17-perfil-administrador.md) y
  [9B.18](./plan-9b.18-perfil-gerencia.md).
- [9B.08](./plan-9b.08-transferencias.md) conserva un plan de diferimiento con criterio de
  reapertura. 9B.09 no tiene plan porque fue retirada y su alcance volvió íntegro a 11.02.

## Disposición de las decisiones

El [registro de decisiones](./gate-decisiones-9b.md) ya no es un gate global. Las decisiones
reversibles de costeo, cliente, devolución y configuración tienen defaults explícitos en
ADR-0016, ADR-0017, ADR-0018 y ADR-0021. El modelo de almacenes se difiere en ADR-0020 y la
reapertura de turnos queda fuera de 9B.12.

La normativa venezolana, la calificación del fabricante, el modelo de impresora, el protocolo
y el firmware bloquean el driver fiscal real y el piloto, no el core fake ni las pantallas
genéricas. Mientras la Fase 8 esté suspendida, toda capacidad fiscal se rotula `SIMULACION`.

## Orden de implementación

1. Completar las capacidades listas: 9B.06, 9B.10 y 9B.12.
2. Construir 9B.13 con ventas e inventario; el margen de 9B.04 ya está disponible.
3. Ensamblar 9B.14–9B.18 según permisos y capacidades presentes. Una acción diferida se muestra
   como no disponible y no se ofrece como capacidad vigente.
4. Mantener 9B.08 diferida hasta que exista un caso de uso multi-almacén aprobado.

## Restricciones

- No se ejecuta trabajo de Fase 10: sin sincronización, escritura multi-nodo ni resolución de
  conflictos.
- No se integra una impresora fiscal real antes de Fase 8.
- No se optimiza rendimiento antes de Fase 12.
- El renderer no contiene reglas de negocio; la autorización ocurre en el caso de uso.
- Se conservan validación de límites, errores, accesibilidad básica, auditoría e idempotencia.

## Criterio de salida

Cada perfil opera las capacidades disponibles desde vistas derivadas de permisos, sin ofrecer
acciones que terminen en `FORBIDDEN`. Las capacidades diferidas tienen dueño y criterio de
reapertura; ninguna se presenta como certificada.
