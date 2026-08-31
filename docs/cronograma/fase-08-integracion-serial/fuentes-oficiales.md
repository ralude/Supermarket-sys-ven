# Fuentes primarias, de fabricante y técnicas para la integración serial fiscal

- **Última revisión:** 2026-08-31
- **Alcance:** planificación técnica; no sustituye asesoría tributaria ni
  validación del fabricante, representante o SENIAT

Este registro separa hechos del transporte, requisitos regulatorios y dialectos
de fabricante. Una fuente antigua puede explicar un equipo, pero no demuestra
que un modelo, firmware o autorización siga vigente.

## SerialPort y Electron

- [SerialPort: Stream interface](https://serialport.io/docs/api-stream/):
  `autoOpen`, eventos `error`/`close`, `write`, backpressure, `drain`, `flush` y
  entrega de chunks arbitrarios.
- [SerialPort: platform support](https://serialport.io/docs/guide-platform-support/):
  plataformas y política de últimas versiones de Electron.
- [SerialPort: testing](https://serialport.io/docs/guide-testing/) y
  [MockBinding](https://serialport.io/docs/api-binding-mock/): pruebas sin
  hardware y sus límites.
- [SerialPort: parsers](https://serialport.io/docs/api-parsers-overview/): parsers
  disponibles; no justifican elegir uno antes de conocer el framing fiscal.
- [SerialPort 13.0.0](https://github.com/serialport/node-serialport/releases/tag/v13.0.0):
  versión publicada que exige Node 20+. El sitio de documentación todavía se
  presenta como 12.x; la versión se fija solo después del spike.
- [Electron 37.10.3](https://releases.electronjs.org/release/v37.10.3),
  [calendario](https://releases.electronjs.org/schedule) y
  [política de soporte](https://www.electronjs.org/docs/latest/tutorial/electron-timelines):
  el runtime actual incluye Node 22, pero Electron 37 está EOL desde
  2026-01-13. No es una base aceptable para el piloto sin actualización.
- [Módulos nativos en Electron](https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules)
  y [ASAR](https://www.electronjs.org/docs/latest/tutorial/asar-archives):
  requisitos a comprobar en el artefacto empaquetado.
- [Ciclo de Windows 10](https://learn.microsoft.com/es-es/windows/release-health/release-information)
  y [ESU comercial](https://learn.microsoft.com/en-us/windows/whats-new/enable-extended-security-updates):
  Windows 10 general terminó soporte el 2025-10-14; una estación 2026 solo entra
  en la matriz con LTSC vigente o ESU activo y verificado.
- [Reporte SerialPort #3121](https://github.com/serialport/node-serialport/issues/3121):
  evidencia de campo, no especificación, de un `open()` que puede quedar
  pendiente. Justifica calificar hard recovery y aislamiento; no demuestra que
  todas las plataformas tengan el defecto.

Conclusión: SerialPort puede abstraer apertura, exclusividad, buffers,
backpressure, deadlines y desconexión. No confirma que un comando haya sido
procesado, no define el protocolo fiscal y no ofrece cancelación nativa por el
solo hecho de que la aplicación deje vencer un deadline.

## Marco venezolano

- [Gaceta Oficial 41.518, SNAT/2018/0141 (facsímil)](https://armandoalvarezm.wordpress.com/wp-content/uploads/2018/11/gaceta-44064-06_11_2018-pa-0471-maquinas-fiscales1.pdf):
  los artículos 16 y 51 exigen adaptar el software a las especificaciones de la
  impresora y registrar al desarrollador de conectividad ante el fabricante o
  representante; los artículos 25–37 tratan autorización y vigencia por modelo.
  El artículo 32 remite al portal fiscal para el listado vigente.
- [Portal fiscal del SENIAT](http://declaraciones.seniat.gob.ve/portal/page/portal/MANEJADOR_CONTENIDO_SENIAT/05MENU_HORIZONTAL/5.1ASISTENCIA_CONTRIBUYENTE/5.1.4INFORMACION_INTERE/5.1.4.5MAQUINAS_FISCALES/5.1.4.5.1PROVEEDORES_AUTORIZADOS/5.1.4.5.1.1ad.delaye):
  no respondió durante esta revisión. La falta de acceso no autoriza usar un
  listado secundario histórico; se exige constancia actual del representante o
  SENIAT.
- [Gaceta Oficial 39.795, SNAT/2011/00071 (facsímil)](https://drcondominio.com/Recursos/09_GO39795_Providencia0071.pdf):
  contiene reglas generales de facturación, uso de máquinas y contingencias que
  deben validarse para el supermercado con asesoría tributaria.
- [Ley de Reforma del IGTF, G.O. 6.687 (facsímil)](https://www.grantthornton.com.ve/globalassets/1.-member-firms/venezuela/2022/goe-6.687.pdfreforma-igtf-02-2022-1.pdf)
  y [SNAT/2022/000013, G.O. 42.339 (transcripción técnica)](https://www.bdo.com.ve/getattachment/40830284-b177-41af-aeba-dc9f7925f33c/Boletin-Providencia-000013-SENIAT.pdf?ext=.pdf&lang=es-VE):
  antecedentes específicos para pagos en moneda distinta y ajuste de máquinas
  fiscales por sujetos aplicables. Alícuota, sujetos, exenciones y vigencia se
  revalidan con asesoría antes de diseñar campos; no se toman del manual PNP.
- [Gaceta Oficial 43.032, SNAT/2024/000121 (facsímil)](https://ultimasnoticias.com.ve/wp-content/uploads/2024/12/Gaceta-Oficial-43032.pdf):
  antecedente de homologación de proveedores/sistemas; **no está vigente**.
- [Gaceta Oficial 43.435, SNAT/2026/00084 (facsímil)](https://www.marambio-hlb.com/wp-content/uploads/2026/08/GO-43435_260813_135207-1.pdf):
  derogó íntegramente la 000121 con vigencia inmediata el 2026-08-12. La
  derogatoria no menciona la 0141 ni demuestra que desaparecieran la
  autorización por modelo o el registro del artículo 51.
- [Alerta legal de Baker McKenzie sobre la 00084](https://www.bakermckenzie.com/en/insight/publications/2026/08/venezuela-seniat-repeals-rules-for-invoice-system-providers):
  fuente secundaria que corrobora la derogación completa, la ausencia de
  sustitución/transición y la continuidad de las reglas generales de
  facturación; no sustituye el texto de la Gaceta ni la asesoría del proyecto.

Conclusión regulatoria de planificación: conservar integridad, trazabilidad y
recuperación por calidad del sistema, pero no atribuirlas a una 000121 vigente.
Antes del piloto, asesor y fabricante deben confirmar obligaciones actuales,
autorización del modelo, registro del integrador y contingencias aplicables.

## Fuentes de fabricante

### PNP

- [Protocolo fiscal PNP v5.4](https://www.desarrollospnp.com/archivos/PROTOCOLO0141.pdf)
  y [FAQ oficial con simulador](https://desarrollospnp.com/pregunta/): protocolo
  primario publicado para familias enumeradas por PNP.
- [PF-SUNMI](https://desarrollospnp.com/pf-sunmi/): producto publicado
  actualmente por PNP con USB CDC, RS-232 opcional y declaración del fabricante
  sobre SENIAT/GF/0103; la vigencia se confirma por separado.

El manual documenta perfil serial, master/slave, framing, secuencia, separadores,
BCC, estados, respuesta de procesamiento y consulta `Status_IF`. Es evidencia
suficiente para considerar un spike PNP, no para declarar que todo modelo o
firmware actual usa v5.4. PNP debe confirmar la combinación comprada.

La portada del manual v5.4 enumera PF220A, PF220DA, PF300A, PF950A, PF675A y
PFT88A, pero no PF-SUNMI. La página actual de PF-SUNMI enlaza ese protocolo y
declara compatibilidad PNP; esa relación web no sustituye la confirmación
escrita de modelo, firmware y revisión aplicables al equipo comprado.

### The Factory HKA

- [Portal oficial Venezuela](https://www.thefactoryhka.com/ve/home): ofrece un
  canal de Soporte e Integración para casas de software y anuncia herramientas
  para programadores; esa declaración no identifica por sí sola una versión de
  protocolo, SDK o licencia aplicable a PP9-PLUS.
- [Autorización publicada para ACLAS PP9-PLUS](https://thefactoryhka.com/tfhkaBancoImagenesSitesNew/public/productos/pp9-plus/files/69f_Autorizaciones.pdf)
  y [brochure del modelo](https://thefactoryhka.com/tfhkaBancoImagenesSitesNew/public/productos/pp9-plus/files/90f_Brochure.pdf):
  evidencia específica del modelo, no de un protocolo común a toda la marca.
  La autorización `SENIAT/GF/00098` del 30-08-2022 identifica un DCTD interno
  integrado vía Wi-Fi; su copia publicada no sustituye la verificación actual
  de vigencia/no suspensión ni la guía de coexistencia de la instalación.
- [Manual oficial APP HKA POS v1.01.3, 20-03-2024](https://thefactoryhka.com/tfhkaBancoImagenesSitesNew/public/productos/pp9-plus/files/41z_Manual%20de%20Usuario.pdf):
  muestra conexión mediante dongle Bluetooth, apertura/cierre del puerto,
  consultas operativas `STATUS S1` a `S4`, acumulados y el carácter mutante del
  cierre de jornada/Reporte Z. Es evidencia de que existen consultas útiles
  para diseñar reconciliación y de que Z requiere una barrera explícita; no
  publica bytes, firmas de llamadas, códigos de retorno ni una matriz de
  firmware para implementar el adaptador.

No se localizó un manual público primario de comandos ni un SDK/DLL versionado
para Venezuela en la revisión del 31-08-2026. El gate HKA requiere
registro/contacto formal y protocolo o SDK vigente entregado por HKA. Copias de
terceros y manuales de usuario no sirven como especificación de producción.

El brochure declara factura, notas de crédito/débito, USB tipo B, puerto serial
RJ11, Wi-Fi integrado, tasas y categorías que incluyen IGTF. Es evidencia de
capacidades comerciales del modelo, no de framing, parámetros seriales, status
ni reglas de reconciliación. Si el canal formal exige SDK/DLL en lugar de serial
directo, el adaptador debe respetar esa frontera y no forzar SerialPort.

La [plataforma oficial DCTD/iMobile](https://gestion.thefactoryhka.com/) muestra
que el ecosistema incluye múltiples marcas y motores. Esa diversidad obliga a
documentar topología y coexistencia DCTD por modelo; no demuestra que compartan
comandos, interfaz o firmware.

## Reglas de vigencia de fuentes

PNP y HKA/ACLAS son candidatos de producto, no un ranking demostrado de ventas.
La selección comercial se corrobora con distribuidores y centros autorizados;
esa información nunca reemplaza autorización por modelo, protocolo ni HIL.

- Registrar fecha, URL, versión del documento y persona/organización que lo
  confirmó para cada matriz.
- Guardar una copia permitida o hash de la fuente recibida cuando el fabricante
  la distribuya bajo acceso restringido, respetando sus condiciones.
- Revalidar autorización, firmware, protocolo y regulación antes de comprar,
  antes del piloto y ante cada actualización relevante.
- Una autorización de modelo no cubre automáticamente otra marca, modelo,
  firmware, interfaz o DCTD.
- Una fuente no oficial puede abrir una investigación, pero no cerrar un gate.
