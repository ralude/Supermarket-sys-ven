# Fase 7: Driver fiscal fake

- **Estado:** Completada
- **Indice:** [Cronograma](../README.md)

## Proposito

Probar el contrato fiscal con una impresora simulada antes de conectar hardware real.

## Sub-fases

- [~~7.01 Puerto FiscalPrinter~~](./7.01-fiscal-printer-port.md)
- [~~7.02 Respuestas simuladas~~](./7.02-respuestas-simuladas.md)
- [~~7.03 Estado del documento~~](./7.03-maquina-estados-documento.md)
- [~~7.04 Emision y reportes~~](./7.04-emision-reportes.md)
- [~~7.05 Contract tests~~](./7.05-contract-tests.md)

## Restriccion

No instalar ni usar SerialPort. Toda prueba usa `FiscalPrinterFake`.

## Criterio de salida

Los comandos y estados fiscales se prueban ante respuestas correctas, errores y recuperacion.

## Resultado

El puerto, el fake determinista, la maquina de estados, la persistencia y los casos de uso de documentos y reportes quedaron integrados. El contrato reutilizable de pruebas y sus fixtures quedan disponibles para validar el adaptador real de la Fase 8 sin usar hardware en esta fase.
