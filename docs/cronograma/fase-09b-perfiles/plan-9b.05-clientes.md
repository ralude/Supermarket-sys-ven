# Plan de ejecución 9B.05: Identificación opcional del receptor

- **Sub-fase:** [9B.05 Clientes e identificación fiscal](./9b.05-clientes.md)
- **Estado del plan:** Ejecutado
- **Decisiones:** [ADR-0018](../../architecture/adr/0018-datos-obligatorios-del-cliente.md) y
  [ADR-0021](../../architecture/adr/0021-mvp-referencia-no-certificado.md)
- **Disciplina:** Outside-in TDD (ADR-0007) y Ponytail `full`

## Resultado esperado

Adjuntar a una venta en borrador un snapshot opcional del receptor y propagarlo al documento
fiscal fake. Una venta anónima continúa válida en `SIMULACION`; no se crea un maestro de
clientes ni se presenta la captura como cumplimiento fiscal.

## Línea base comprobada

- `Sale`, `SaleDto`, los contratos HTTP y las tablas de venta no tienen receptor.
- `FiscalDocumentContent` contiene referencia, tipo, moneda, líneas, pagos y total, pero no
  identificación del receptor.
- Una venta completada ya es inmutable. El fake fiscal persiste el contenido recibido y el
  renderer ya muestra el modo `SIMULACION`.
- Los logs técnicos prohíben RIF, cédula, nombre y dirección.

## Decisiones de frontera

- Se modela `SaleRecipientSnapshot`, no `Customer`: tipo soportado, valor capturado,
  `normalizedValue`, nombre y dirección opcionales. Si el snapshot existe, tipo y valor son no
  vacíos; nombre y dirección se conservan solo cuando el operador los proporciona.
- La forma venezolana reutiliza la canonicalización estructural aprobada para identidades
  fiscales, sin checksum. Fuera de Venezuela solo se admite la forma genérica definida por
  ADR-0018; no se inventan validadores por país.
- Un comando idempotente actualiza o retira el snapshot únicamente mientras la venta está
  `DRAFT` y pertenece a la terminal/nodo de la sesión. Completar congela el valor.
- El snapshot se persiste con la venta y viaja en su DTO y en `FiscalDocumentContent`. El
  documento fiscal guarda una copia; no referencia datos mutables.
- No se agrega permiso de administración de clientes. El comando tiene la misma frontera de
  sesión que la edición ordinaria de una venta; la API sigue siendo la autoridad.

## Secuencia outside-in

1. Probar venta anónima y venta con receptor estructuralmente válido.
2. Probar canonicalización, campos obligatorios cuando hay snapshot y rechazo de formas no
   soportadas.
3. Probar actualización/retiro en `DRAFT`, ownership de terminal/nodo e idempotencia.
4. Probar que una venta `COMPLETED` no admite cambios y que el snapshot no cambia al editar
   cualquier dato maestro posterior.
5. Probar persistencia/rehidratación y propagación exacta al documento fiscal fake.
6. Probar que logs y auditoría no copian PII innecesaria.
7. Añadir el mínimo dominio, comando, puerto existente ampliado, migración, contrato, ruta y
   formulario de venta; mantener visible `SIMULACION`.
8. Ejecutar las verificaciones y actualizar cronograma/arquitectura si cambia un contrato.

## Criterios de aceptación

- [x] La venta anónima continúa siendo válida en simulación.
- [x] El snapshot presente se valida en dominio, se persiste y queda inmutable al completar.
- [x] El documento fake recibe una copia del receptor y sigue rotulado `SIMULACION`.
- [x] No existe agregado, repositorio, CRUD ni tabla maestra `Customer`.
- [x] No se registra PII del receptor en logs técnicos.
- [x] La migración forward-only y los contratos están cubiertos por pruebas.
- [x] `pnpm test`, `pnpm typecheck` y `pnpm lint` quedan verdes.

## Fuera de alcance

- Historial, búsqueda, fidelización, crédito o exportación por cliente.
- Umbrales fiscales, checksum y validación legal por jurisdicción.
- Retención, anonimización o borrado de un maestro que no existe en este corte.
