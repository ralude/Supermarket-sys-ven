# Core Application

Esta carpeta será la única ubicación para casos de uso, DTOs, puertos, autorización y coordinación transaccional.

Los adaptadores concretos deben vivir en `packages/drivers/*`. No colocar aquí rutas HTTP, handlers IPC ni consultas Drizzle.
