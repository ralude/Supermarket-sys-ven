# Fase 9B: Perfiles operativos y capacidades faltantes

- **Estado:** En progreso
- **Indice:** [Cronograma](../README.md)
- **Replanificacion:** [Insercion de Fase 9B antes de Fase 10](../replanificacion-fase-09b.md)

## Proposito

Reorganizar la interfaz alrededor de los cinco perfiles que operan un supermercado
(cajero, jefe de cajas, inventario, administrador y gerencia) y construir las
capacidades de negocio que esos perfiles necesitan y que hoy no existen.

La Fase 9 entrego una pantalla por modulo tecnico. Esta fase entrega una vista por
trabajo real: cada operador ve lo que su rol autoriza y nada mas, y las acciones que
faltaban (devoluciones, proveedores, conteos, transferencias, clientes, usuarios,
configuracion y KPIs) dejan de ser una brecha declarada para convertirse en negocio
implementado.

Esta fase no es de rendimiento. La Fase 12 conserva su alcance de optimizacion medida.

## Sub-fases

### Fundacion

- [~~9B.00 Permisos efectivos en la sesion~~](./9b.00-permisos-en-sesion.md)
- [~~9B.01 Reestructuracion del renderer~~](./9b.01-reestructuracion-renderer.md)
- [~~9B.02 Datos maestros seleccionables~~](./9b.02-datos-maestros-seleccionables.md)

### Capacidades de negocio

- [9B.03 Proveedores](./9b.03-proveedores.md)
- [9B.04 Costo de compra y margen](./9b.04-costo-y-margen.md)
- [9B.05 Clientes e identificacion fiscal](./9b.05-clientes.md)
- [9B.06 Devoluciones y notas de credito](./9b.06-devoluciones.md)
- [9B.07 Conteos fisicos](./9b.07-conteos-fisicos.md)
- [9B.08 Transferencias de existencia](./9b.08-transferencias.md)
- [9B.09 Usuarios, roles y permisos](./9b.09-usuarios-y-roles.md)
- [9B.10 Configuracion operativa](./9b.10-configuracion-operativa.md)
- [9B.11 Sucursales y dispositivos](./9b.11-sucursales-y-dispositivos.md)
- [9B.12 Arqueos, reapertura y autorizaciones](./9b.12-arqueos-y-autorizaciones.md)
- [9B.13 KPIs de gerencia](./9b.13-kpis-de-gerencia.md)

### Perfiles

- [9B.14 Perfil Cajero](./9b.14-perfil-cajero.md)
- [9B.15 Perfil Jefe de cajas](./9b.15-perfil-supervisor.md)
- [9B.16 Perfil Inventario](./9b.16-perfil-inventario.md)
- [9B.17 Perfil Administrador](./9b.17-perfil-administrador.md)
- [9B.18 Perfil Gerencia](./9b.18-perfil-gerencia.md)

## Decisiones de negocio pendientes

Tres sub-fases estan bloqueadas hasta que el negocio cierre su decision. No se codifican
defaults ni se deducen del codigo existente:

1. **Metodo de costeo** (bloquea 9B.04 y todo margen): promedio ponderado, FIFO o costo
   estandar. Hoy no se persiste ningun costo de compra. Se registra en ADR-0016.
2. **Politica de devolucion** (bloquea 9B.06): ventana de tiempo, si exige la venta
   original, si admite devolucion parcial y si repone inventario. Se registra en ADR-0017.
3. **Datos obligatorios del cliente** (bloquea 9B.05): RIF/CI, nombre, direccion, umbral a
   partir del cual son exigibles, y si el cliente es entidad persistida o dato copiado en la
   venta. Se registra en ADR-0018.

La sub-fase 9B.00 produce ADR-0015 con la decision de permisos efectivos en la sesion; esa
decision es de ingenieria y no depende del negocio.

9B.03 ya tiene reglas de proveedor aprobadas y su planificación reveló una contradicción
entre el snapshot de una recepción `COMPLETED` —que debe incluir costos— y la prohibición de
adelantar el costeo de 9B.04. También faltan las reglas fiscales por país/tipo y la semántica
de corrección de recepciones. [ADR-0019](../../architecture/adr/0019-proveedores-y-recepciones-de-compra.md)
acepta separar el maestro de proveedor en 9B.03 del documento completo de 9B.04; los puntos
documentales pendientes permanecen enumerados en el [plan](./plan-9b.03-proveedores.md).

## Restriccion

La Fase 8 permanece suspendida. Toda capacidad fiscal nueva de esta fase, incluida la nota
de credito de 9B.06, se construye sobre `FiscalPrinterFake`, se rotula visiblemente como
`SIMULACION` y no declara emision legal, compatibilidad de hardware ni habilitacion para
piloto.

Esta fase no ejecuta trabajo de Fase 10: no hay cola de sincronizacion, escritura multi-nodo
ni resolucion de conflictos. La sucursal se modela como dato maestro y etiqueta de
pertenencia; su autoridad de escritura multi-nodo sigue en Fase 10 y en
`docs/architecture/12-sincronizacion-y-ownership.md`.

Los permisos nuevos se agregan al conjunto del administrador inicial. Su asignacion a otros
roles permanece configurable, como fija ADR-0012. Ocultar una accion en el renderer nunca
sustituye la autorizacion del caso de uso.

## Disciplina de diseno visual

Continua la disciplina Ponytail heredada de la Fase 9: se reutiliza el shell existente, se
prefieren HTML semantico, controles nativos y CSS antes que JavaScript o dependencias, y no
se crea un design system para necesidades hipoteticas. La simplificacion nunca elimina
validacion, estados de carga/error, accesibilidad basica ni el rotulo `SIMULACION`.

## Orden de entrada

1. Ejecutar 9B.00, 9B.01 y 9B.02 en ese orden. Son la fundacion: sin permisos efectivos en
   la sesion no hay navegacion por perfil, y sin datos maestros seleccionables toda pantalla
   nueva repetiria el defecto de pedir identificadores escritos a mano.
2. Continuar con las capacidades de negocio 9B.03 a 9B.13. Las que dependen de una decision
   pendiente no se inician hasta que su ADR este aceptado.
3. Ensamblar los perfiles 9B.14 a 9B.18 al final, cuando las capacidades que agrupan ya
   existan.

Cada sub-fase abre su `plan-9b.NN-*.md` antes de implementar, con la misma estructura que los
planes de la Fase 9: resultado esperado, linea base comprobada, decisiones de frontera,
decisiones requeridas, secuencia outside-in, criterios de aceptacion y fuera de alcance.

Las tres sub-fases de fundacion ya tienen su especificacion escrita y sus criterios de
aceptacion aprobados antes de implementar, como exige la disciplina spec-driven de AGENTS.md:
[plan 9B.00](./plan-9b.00-permisos-en-sesion.md),
[plan 9B.01](./plan-9b.01-reestructuracion-renderer.md) y
[plan 9B.02](./plan-9b.02-datos-maestros-seleccionables.md). 9B.03 tiene un
[plan en ejecución](./plan-9b.03-proveedores.md) y ADR-0019 aceptado para su corte. Las demás
se escriben cuando su sub-fase entre en ejecución, y las
bloqueadas por una decisión de negocio no abren plan hasta que su ADR esté aceptado.

## Criterio de salida

Cada perfil opera su trabajo completo desde vistas propias derivadas de los permisos que el
servidor autoriza, sin pantallas que ofrezcan acciones que terminaran en `FORBIDDEN`, y sin
capacidades declaradas como brecha en el alcance de esta fase.
