# ADR-0018: Identificación del cliente en la venta

- Estado: **Aceptado para MVP técnico no certificado**
- Fecha: 2026-09-04
- Alcance: captura opcional y snapshot por venta; no define obligaciones fiscales universales.

## Contexto

El dominio no tiene un agregado `Customer` ni una tabla de clientes. Crear un maestro completo
introduciría ciclo de vida, privacidad, permisos e historial antes de que exista un consumidor
del MVP. La venta sí debe poder conservar los datos que el operador capturó.

## Decisión para el MVP

1. No se crea el agregado ni el repositorio `Customer` en esta fase.
2. La venta puede llevar un **snapshot opcional** del receptor: tipo, valor normalizado,
   nombre y dirección cuando el operador los proporcione. Corregir el dato futuro no reescribe
   la venta emitida.
3. Una venta anónima sigue siendo válida en el modo `SIMULACION`. Un perfil fiscal real puede
   exigir campos adicionales sin cambiar el contrato base.
4. La identificación presente se canonicaliza en dominio. Se valida la forma soportada y no se
   añade checksum ni algoritmo por país sin una fuente profesional verificable.
5. Los datos personales no aparecen en logs técnicos. La auditoría de negocio conserva solo lo
   necesario para explicar la acción y sigue las reglas de acceso existentes.

## Extensiones diferidas

Maestro reutilizable, historial por cliente, umbrales internos, validadores tributarios por
país, retención, exportación y borrado lógico se agregan cuando tengan consumidor, política de
datos y criterios de salida propios.

## Consecuencias

9B.05 puede entregar captura y propagación al documento fake sin bloquear 9B.14. La eventual
obligación de identificar al adquirente se configura en el perfil fiscal del despliegue, no se
presenta como una garantía del core.
