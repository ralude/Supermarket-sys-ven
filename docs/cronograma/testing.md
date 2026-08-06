# Estrategia de Testing

La piramide de pruebas prioriza reglas de dominio rapidas y deterministas, y agrega infraestructura real antes de las pruebas end-to-end.

## Niveles

1. **Unit:** todo el dominio sin SQLite, Electron, Fastify ni hardware. Incluye IVA, descuentos, totales, estados de venta, caja, inventario y permisos.
2. **Integration:** SQLite real sobre bases temporales. No se usan mocks para guardar, leer o actualizar ventas y agregados persistidos.
3. **Contract:** cada comando y puerto verifica su contrato. El protocolo fiscal cubre `OPEN`, `ITEM`, `PAYMENT` y `CLOSE`.
4. **Simulation:** impresora virtual con ACK, NAK, sin papel, memoria llena, busy, timeout, CRC y puerto cerrado.
5. **E2E:** flujos completos desde la interfaz y el transporte HTTP cuando la Fase 9 este disponible.
6. **Chaos:** fallos de sistema operativo, USB, red, Electron y cierre fiscal.

## Reglas por fase

- Fase 2: unit tests outside-in para cada caso de uso y unit tests del dominio.
- Fase 3: integration tests con SQLite real y transacciones reales.
- Fase 4: pruebas de append-only, outbox, idempotencia y reconstruccion de historial.
- Fases 5 y 6: flujos integrados auditados de caja e inventario.
- Fases 7 y 8: contract tests, simulacion y reconciliacion del driver fiscal.
- Fase 9: E2E de venta, caja, catalogo e inventario.

## Escenarios de chaos testing

- Apagar Windows durante una venta.
- Desconectar USB mientras se imprime.
- Eliminar Internet mientras sincroniza.
- Cerrar Electron con una factura abierta.
- Reiniciar el equipo durante el cierre Z.

Cada escenario debe definir estado inicial, fallo inyectado, estado esperado recuperable y evidencia de que no se duplicaron efectos.
