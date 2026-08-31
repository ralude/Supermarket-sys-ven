# 00. Contexto y alcance

## Contexto

El sistema será una plataforma de operación para supermercados empresariales en Venezuela. Debe soportar punto de venta, caja, catálogo, moneda local y extranjera, pagos mixtos, trazabilidad y futura integración fiscal.

El diseño parte de nodos operativos autónomos:

- **Standalone:** Electron inicia un servidor Fastify local y una base SQLite local.
- **LAN:** cada estación mantiene Fastify y SQLite local; un nodo coordinador distribuye datos de referencia y recibe eventos para consolidación.
- **Evolución futura:** el coordinador puede sincronizar con una sede central o nube sin acoplarla al dominio.

## Objetivos arquitectónicos

1. Mantener el dominio independiente de Electron, Fastify, Drizzle y SQLite.
2. Permitir reemplazar la impresora fiscal mediante adaptadores.
3. Hacer explícitos los estados de una operación fiscal y recuperarlos después de un reinicio.
4. Mantener consistencia monetaria con VES, USD y otras monedas configurables.
5. Auditar acciones sensibles sin mezclar auditoría con logs técnicos.
6. Probar reglas de negocio sin requerir hardware ni una interfaz gráfica.

## No objetivos de la Fase 0

- No se implementan endpoints funcionales.
- No se implementan tablas de negocio ni migraciones de ventas.
- No se implementan entidades o agregados ejecutables.
- No se integra una impresora fiscal real.
- No se afirma cumplimiento fiscal automático por el mero uso de esta arquitectura.

## Principios

- **Offline-first en POS:** una interrupción de LAN no impide completar una venta local permitida; la sincronización ocurre posteriormente.
- **Single writer:** solo el proceso servidor abre la SQLite de un nodo.
- **Single owner:** cada agregado tiene un único nodo con autoridad de escritura.
- **Explicit boundaries:** cada módulo tiene contratos y responsabilidades claros.
- **Immutable fiscal history:** un documento fiscal emitido no se edita; se corrige mediante el mecanismo fiscal correspondiente.
- **Configuration over constants:** tasas, impuestos, monedas y límites fiscales son configuración versionada.
- **Auditability:** toda operación sensible identifica actor, terminal, momento y motivo.
- **Least privilege:** Electron renderer no tiene acceso directo al sistema operativo ni a la base de datos.

## Decisiones pendientes para fases posteriores

- fabricante/representante, modelo autorizado, protocolo y firmware exactos;
- política definitiva de inventario offline para el piloto;
- proveedor oficial de tasa de cambio y frecuencia de actualización;
- política de retención y exportación de datos;
- requisitos definitivos de hardware por modelo de tienda.
