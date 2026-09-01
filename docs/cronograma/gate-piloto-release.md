# Gate de piloto y release

- **Estado:** Pendiente
- **Aplica después de:** MVP técnico funcional
- **Bloqueo vigente:** la Fase 8 está suspendida y debe reanudarse y completarse
  antes de cerrar este gate; el modo fiscal simulado no habilita una tienda.

## Propósito

Separar funcionalidad terminada de capacidad real para instalar, operar, recuperar y soportar el sistema en una tienda.

## Tareas mínimas para piloto

- [ ] Configurar CI remoto obligatorio y umbrales de coverage acordados.
- [ ] Generar instalador reproducible y definir firma de ejecutables.
- [ ] Probar actualización, migración y rollback mediante backup.
- [ ] Automatizar backup y ensayar restauración con datos representativos.
- [ ] Ejecutar chaos tests de energía, LAN, Electron y dispositivo fiscal.
- [ ] Conservar dos perfiles fiscales aprobados por Fase 8, cada uno con
  fabricante/representante, hardware autorizado y una fila exacta de modelo,
  firmware, protocolo o SDK, interfaz y plataforma. La tienda piloto puede usar
  uno de los perfiles, pero no una combinacion fuera de esas filas.
- [ ] Conservar por perfil evidencia vigente de autorizacion del modelo, registro
  del desarrollador de conectividad ante el fabricante y revision tributaria
  aplicable.
- [ ] Validar por perfil coexistencia con el DCTD en la topologia autorizada y
  documentar el responsable de configuracion, transmision y soporte.
- [ ] Aprobar la edicion y ciclo de seguridad de Windows; Windows 10 requiere
  LTSC vigente o ESU activo, no solo compatibilidad tecnica del binding.
- [ ] Revalidar el marco fiscal antes del piloto; no presentar SNAT/2024/000121 como vigente despues de su derogacion por SNAT/2026/00084.
- [ ] Definir configuración inicial de tienda, terminales, usuarios y dispositivos.
- [ ] Crear runbooks de base de datos, red, caja y fiscalidad.
- [ ] Definir exportación segura de diagnóstico y política de soporte.

## Criterio de salida

Una instalación piloto puede desplegarse, actualizarse, recuperarse y diagnosticarse sin procedimientos improvisados ni pérdida silenciosa de operaciones.
