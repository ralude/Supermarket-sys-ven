# ADR-0002: Transporte de negocio e IPC

- Estado: Aceptado
- Fecha: 2026-08-05
- Precisado por: ADR-0008

## Contexto

El producto debe funcionar en un equipo standalone y evolucionar a múltiples terminales en LAN. Electron IPC es excelente para capacidades nativas, pero no es un transporte adecuado para exponer toda la aplicación de negocio.

## Decisión

Fastify será el transporte de negocio mediante REST versionado. El servidor se ejecuta localmente en cada terminal; el nodo coordinador usa el mismo stack para sincronización y servicios de tienda. Electron IPC se limitará a operaciones nativas y hardware local.

## Consecuencias

- React usa el mismo cliente HTTP en ambos modos.
- Las capacidades privilegiadas quedan detrás de preload y `contextBridge`.
- Se requiere autenticación y control de reconexión también en localhost.
- La comunicación push utilizará WebSocket, tanto por loopback como por LAN.
