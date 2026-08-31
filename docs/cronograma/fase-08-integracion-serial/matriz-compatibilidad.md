# Matriz de compatibilidad fiscal

- **Última revisión:** 2026-08-31
- **Estado de las filas:** `CANDIDATE`; ninguna combinación está soportada aún
- **Fuentes:** [registro de fuentes oficiales](./fuentes-oficiales.md)

## Regla de lectura

Una fila solo pasa de `CANDIDATE` a `QUALIFIED` cuando todas sus dimensiones
están fijadas y existe evidencia del fabricante, registro del integrador,
hardware-in-the-loop y build Windows empaquetado. Un dato comercial publicado
no sustituye firmware, protocolo, autorización vigente ni prueba física.

Solo una fila `QUALIFIED` puede seleccionarse en una instalación. Cualquier
modelo, firmware, interfaz o plataforma no enumerados se consideran
`UNSUPPORTED`, aunque pertenezcan a la misma marca.

## Perfil 1: Desarrollos PNP

- **Estado:** `CANDIDATE`.
- **Fabricante/familia:** Desarrollos PNP / Protocolo Fiscal PNP.
- **Modelo objetivo:** PF-SUNMI, pendiente de confirmación final y compra.
- **Autorización publicada:** la página del fabricante declara
  `SENIAT/GF/0103`; falta constancia vigente/no suspensión por el canal formal.
- **Firmware:** pendiente de identificar en el equipo y confirmar por escrito.
- **Protocolo:** candidato PNP v5.4. El manual público enumera PF220A, PF220DA,
  PF300A, PF950A, PF675A y PFT88A, pero no PF-SUNMI; la correspondencia exacta
  permanece bloqueante.
- **Interfaz candidata:** USB CDC serial; RS-232 opcional. Path COM y driver se
  determinan en el laboratorio, nunca por autodetección permisiva.
- **DCTD:** PNPDT01 interno Wi-Fi según la página del producto; topología,
  puertos reservados y coexistencia requieren guía y prueba del fabricante.
- **Capacidades comerciales publicadas:** factura, nota de crédito, X, Z,
  memoria fiscal/auditoría e IGTF. Cada comando y campo permanece pendiente del
  manifiesto confirmado.
- **Plataforma objetivo:** Windows 11 x64; runtime Electron/Node, versión de
  SerialPort, binding y packaging pendientes del gate nativo.
- **Canal de integración:** el manual y FAQ oficiales remiten a
  `integracion@abacco.com` y al registro de integradores PNP.
- **Bloqueos para implementar:** confirmación modelo + firmware + protocolo,
  unidad controlada, registro completado, autorización vigente, DCTD y decisión
  de runtime.

## Perfil 2: The Factory HKA / ACLAS

- **Estado:** `CANDIDATE`.
- **Fabricante/familia:** The Factory HKA / ACLAS.
- **Modelo objetivo:** PP9-PLUS, pendiente de firmware y compra.
- **Autorización publicada:** existe una copia específica del modelo alojada por
  HKA; falta verificar vigencia/no suspensión y datos exactos con HKA/SENIAT.
- **Firmware:** pendiente de matriz oficial y lectura del equipo.
- **Protocolo o SDK:** pendiente. No se localizó una especificación pública
  primaria de comandos ni SDK/DLL versionado para Venezuela en la revisión del
  31-08-2026; debe recibirse por Soporte e Integración HKA con licencia y
  versión.
- **Interfaz candidata:** USB tipo B; el brochure también identifica un puerto
  serial RJ11 configurable y Bluetooth opcional. Esto no demuestra CDC ni
  autoriza asumir framing serial.
- **DCTD:** la autorización publicada `SENIAT/GF/00098` del 30-08-2022 describe
  el PP9-PLUS como máquina con DCTD interno integrado a la tarjeta fiscal vía
  Wi-Fi; falta confirmar vigencia y obtener la guía formal de coexistencia,
  topología y responsabilidades para el equipo comprado.
- **Capacidades comerciales publicadas:** factura, notas de crédito/débito,
  documentos no fiscales, categorías de impuesto que incluyen percibido/IGTF,
  memoria fiscal y auditoría. El manual APP HKA POS v1.01.3 además muestra
  `STATUS S1` a `S4`, acumulados y cierre Z, pero no su API. Nota de débito no
  entra automáticamente en alcance.
- **Plataforma objetivo:** Windows 11 x64; transporte, arquitectura, runtime,
  binarios y packaging dependen de la documentación entregada.
- **Canal de integración:** portal oficial Venezuela y Soporte e Integración de
  The Factory HKA.
- **Bloqueos para implementar:** protocolo/SDK autorizado, modelo + firmware,
  unidad controlada, registro del integrador, autorización vigente, DCTD y
  consultas de reconciliación.

## Evidencia de presencia comercial

Las fuentes confirman productos, fabricantes y canales locales, pero no ofrecen
una estadística pública confiable de participación de mercado. Antes de comprar
se registran consultas fechadas a distribuidores o centros autorizados sobre
disponibilidad, base instalada atendida, repuestos, firmware comercial y soporte.
Esa corroboración decide viabilidad comercial; nunca reemplaza los gates
técnicos o regulatorios.

## Cierre previsto

La Fase 8 exige dos filas `QUALIFIED`, una por perfil, con expedientes separados.
Si HKA/ACLAS no entrega una vía de integración autorizada suficiente, se registra
una decisión de sustitución; no se marca la fase completa usando evidencia PNP
para ambas filas.
