# Alcance por nivel de entrega

Este documento separa el alcance técnico actual de las condiciones necesarias para operar y evolucionar el producto. No agrega funcionalidades a la fase vigente; define qué significa terminar cada nivel.

## 1. MVP técnico

Demuestra los flujos principales y las decisiones arquitectónicas en un entorno controlado.

Incluye:

- catálogo, moneda, ventas, caja e inventario básico;
- persistencia local por nodo;
- historial append-only, outbox, auditoría e idempotencia;
- impresora fiscal fake y pruebas de contrato; durante la suspensión aprobada de
  Fase 8, el MVP técnico se demuestra en modo fiscal simulado y no declara
  perfiles reales ni compatibilidad fiscal;
- UI para los flujos principales;
- prueba de sincronización entre una terminal autónoma y un nodo coordinador.

No garantiza todavía instalación desatendida, soporte remoto, actualización segura ni cumplimiento fiscal certificado.

## 2. Piloto en tienda

Valida el producto en una tienda y con hardware controlado.

Requiere:

- autenticación, autorización y auditoría aplicadas de extremo a extremo;
- política aprobada de inventario durante desconexiones;
- backup automático y restauración ensayada;
- recuperación después de reinicio, corte eléctrico y pérdida de LAN;
- dos perfiles fiscales validados por separado con fabricante/representante y
  una matriz explícita de modelo, firmware, protocolo o SDK e interfaz; una
  tienda piloto puede instalar uno de los perfiles aprobados sin tener ambos
  equipos simultáneamente;
- evidencia vigente de autorización por modelo, registro del integrador y revisión tributaria antes de operar;
- coexistencia ensayada con el DCTD y soporte autorizado de la topología instalada;
- instalación, actualización y rollback ensayados;
- matriz concreta de Windows, terminales y periféricos soportados;
- runbooks de caja, base de datos, red y dispositivo fiscal.

## 3. Producción soportada

Permite desplegar, actualizar, observar y dar soporte al producto de forma repetible.

Requiere:

- builds reproducibles y CI remoto obligatorio;
- ejecutables e instaladores firmados;
- migraciones verificadas durante upgrades;
- rotación, retención y exportación segura de logs y auditoría;
- diagnóstico remoto con consentimiento y redacción de datos sensibles;
- objetivos medidos de recuperación, disponibilidad y rendimiento;
- política de versiones compatibles y soporte;
- proceso repetible para agregar una tercera o posterior familia fiscal mediante
  protocolo oficial, adaptador independiente y calificación con hardware;
  ninguna marca se considera compatible por defecto.

## 4. Plataforma empresarial

Amplía la operación POS a capacidades administrativas y multi-sede.

Puede incluir, mediante fases futuras aprobadas:

- compras y proveedores completos;
- clientes y datos fiscales;
- reportes administrativos y financieros;
- consolidación y operación multi-sede;
- gobierno de catálogos, precios y promociones;
- integraciones contables, de pagos y analítica.

Estas capacidades no forman parte implícita del MVP. Cada una debe incorporarse con alcance, ADR cuando aplique y criterio de salida propio.

## Regla de avance

Con la [replanificación aprobada](../cronograma/replanificacion-fase-08-a-09.md),
completar las fases 0–7 y 9–12 demuestra el MVP técnico únicamente en modo
fiscal simulado. La Fase 8 sigue siendo obligatoria para habilitar el piloto:
debe reanudarse y completarse con sus dos perfiles exactos antes de cerrar el
gate operativo. El paso a piloto o producción depende además de los demás
gates; no se deduce únicamente de que las funcionalidades estén implementadas.
