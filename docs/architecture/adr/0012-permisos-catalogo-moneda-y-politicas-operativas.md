# ADR-0012: Permisos de catálogo/moneda y políticas operativas versionadas

- Estado: Aceptado
- Fecha: 2026-09-01

## Contexto

La API de Fase 9 necesita exponer catálogo, moneda y ventas sin delegar la
autorización al transporte ni codificar límites comerciales o tasas
regulatorias. Los casos de uso existentes no tenían permisos estables para
catálogo/moneda ni una fuente productiva para descuento e IGTF.

## Decisión

- Los comandos usan estos permisos estables:
  `catalog.product.create`, `catalog.product.update`, `catalog.price.update` y
  `currency.rate.update`.
- Las lecturas de catálogo, tasa vigente y cálculo de pagos mixtos exigen una
  sesión válida, sin permiso adicional.
- La autorización de comandos ocurre en aplicación antes de leer o persistir
  agregados. HTTP solo autentica, valida y adapta.
- El administrador inicial recibe estos permisos. Las demás asignaciones se
  mantienen configurables mediante roles.
- `DiscountPolicyProvider` y `FinancialTransactionTaxPolicyProvider` leen
  configuración local versionada y auditable. No existe valor regulatorio ni
  política comercial predeterminada.
- Si falta una política requerida, el caso de uso falla cerrado con
  `POLICY_NOT_CONFIGURED`; la ruta de venta no sustituye ese dato.

## Consecuencias

- Los códigos de permiso forman parte del contrato estable de aplicación.
- Catálogo y tasas pueden operar offline con la configuración confirmada local.
- Las rutas de cobro no se habilitan con políticas ficticias para pruebas.
- La autoridad y distribución multi-nodo de estas configuraciones se completa
  en Fase 10 sin cambiar los contratos de los proveedores.
