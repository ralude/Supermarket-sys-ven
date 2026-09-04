# ADR-0011: Autenticación por PIN y sesiones locales revocables

- Estado: Aceptado
- Fecha: 2026-09-01

## Contexto

La UI operativa consume Fastify por loopback y cada terminal debe funcionar sin
LAN. El gate pre-UI exige identidad verificable, autorización y revocación sin
exponer credenciales o tokens al renderer.

## Decisión

- El operador inicia sesión con `operatorCode` y PIN numérico de 6 a 12
  dígitos. El PIN se guarda mediante scrypt con salt individual.
- Cinco fallos dentro de 15 minutos bloquean al operador durante 15 minutos en
  ese nodo. El contador se identifica por `(originNodeId, operatorId)`.
- El contador, el bloqueo y la creación de sesión se serializan con
  `BEGIN IMMEDIATE`. Un éxito reinicia el contador; una ventana vencida también
  lo reinicia antes de evaluar el siguiente fallo.
- La sesión usa un token opaco aleatorio de 256 bits. SQLite conserva solo su
  hash SHA-256. Expira tras 30 minutos de inactividad o 8 horas absolutas.
- Logout, desactivación o cambio de autorización revocan la sesión.
- El token viaja en cookie `HttpOnly`, `SameSite=Strict`, limitada a
  `/api/v1`. React no puede leerlo.
- `terminalId` y `originNodeId` proceden de
  `%ProgramData%\SupermarketPlatform\node-identity.json`, provisionado con ACL
  local. El composition root lo carga una vez; HTTP nunca puede sobrescribirlo.
- El primer administrador se crea mediante CLI local interactivo. No existe
  usuario ni PIN predeterminado.
- Operador inexistente y PIN incorrecto producen la misma respuesta pública y
  trabajo criptográfico equivalente.

## Consecuencias

- El bloqueo es global por operador dentro del nodo, no entre nodos offline.
  Fase 10 puede distribuir eventos, pero no promete bloqueo inmediato global
  sin conectividad.
- Cada nodo puede permitir hasta cuatro fallos adicionales del mismo operador
  antes de conocer bloqueos de otros nodos.
- La cookie sobre loopback HTTP no usa `Secure`; cualquier despliegue HTTPS debe
  activarlo. La API operativa de Fase 9 permanece enlazada a loopback.
- Credenciales, sesiones y lockouts requieren migración forward-only, pruebas
  de concurrencia y redacción estricta.

