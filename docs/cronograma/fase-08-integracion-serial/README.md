# Fase 8: Integracion serial

- **Estado:** Pendiente
- **Indice:** [Cronograma](../README.md)

## Proposito

Conectar el puerto serial real solo despues de validar el contrato con el driver fake.

## Sub-fases

- [8.01 Adaptador SerialPort](./8.01-serialport-adapter.md)
- [8.02 Parser](./8.02-parser-protocolo.md)
- [8.03 Command queue](./8.03-command-queue.md)
- [8.04 Retry y reconciliacion](./8.04-retry-reconciliacion.md)
- [8.05 State machine](./8.05-state-machine-dispositivo.md)

## Restriccion

Esta fase no puede iniciar antes de completar la Fase 7.

## Criterio de salida

El adaptador tolera busy, timeout, errores de CRC, desconexion y recuperacion sin duplicar comandos.
