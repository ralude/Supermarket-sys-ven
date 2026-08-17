# Gate de piloto y release

- **Estado:** Pendiente
- **Aplica después de:** MVP técnico funcional

## Propósito

Separar funcionalidad terminada de capacidad real para instalar, operar, recuperar y soportar el sistema en una tienda.

## Tareas mínimas para piloto

- [ ] Configurar CI remoto obligatorio y umbrales de coverage acordados.
- [ ] Generar instalador reproducible y definir firma de ejecutables.
- [ ] Probar actualización, migración y rollback mediante backup.
- [ ] Automatizar backup y ensayar restauración con datos representativos.
- [ ] Ejecutar chaos tests de energía, LAN, Electron y dispositivo fiscal.
- [ ] Validar el driver fiscal con proveedor certificado y hardware soportado.
- [ ] Definir configuración inicial de tienda, terminales, usuarios y dispositivos.
- [ ] Crear runbooks de base de datos, red, caja y fiscalidad.
- [ ] Definir exportación segura de diagnóstico y política de soporte.

## Criterio de salida

Una instalación piloto puede desplegarse, actualizarse, recuperarse y diagnosticarse sin procedimientos improvisados ni pérdida silenciosa de operaciones.
