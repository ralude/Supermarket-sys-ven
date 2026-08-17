# Hito transversal: cierre arquitectónico previo a persistencia

- **Estado:** ~~Completado~~
- **Fecha:** 2026-08-14
- **Fase que continúa:** Fase 2, sub-fase 2.03

## Propósito

Cerrar decisiones que afectaban persistencia, sincronización, seguridad, API y alcance sin adelantar implementaciones de fases futuras.

## Tareas

- [x] ~~Separar MVP técnico, piloto, producción soportada y plataforma empresarial.~~
- [x] ~~Aprobar ADR-0008 para terminales autónomas y nodo coordinador.~~
- [x] ~~Aprobar ADR-0009 para estado relacional, ledger, outbox y auditoría.~~
- [x] ~~Definir ownership y política inicial de conflictos por agregado.~~
- [x] ~~Definir el contexto transversal de actor, terminal, nodo, correlación e idempotencia.~~
- [x] ~~Agregar gate de seguridad y sub-fase de composición HTTP antes de UI operativa.~~
- [x] ~~Agregar gate de piloto y release.~~
- [x] ~~Automatizar restricciones críticas de imports mediante ESLint.~~
- [x] ~~Eliminar el aviso ESM de la configuración raíz.~~
- [x] ~~Corregir referencias obsoletas de fases, logging, entidades y pipeline.~~
- [x] ~~Verificar lint, typecheck y 80 pruebas.~~

## Criterio de salida

La Fase 2 puede continuar en 2.03. Antes de iniciar persistencia se deben respetar ADR-0008 y ADR-0009; antes de la UI operativa se ejecuta el gate de seguridad documentado.
