import { useState } from 'react';
import type { AuditReportResponse, CashClosureReportResponse, FiscalOperationsReportResponse } from '@supermarket/shared';
import { isPermissionGranted, printSimulatedXReportContract, printSimulatedZReportContract } from '@supermarket/shared';
import { createIdempotencyKey, type OperationApi, type ReportQuery } from '../api-client.js';
import {
  ActionButton, EmptyState, Feedback, ScreenNote, SectionError, money, section,
  type ReportSection, type ScreenProps
} from './shared.js';

export type OperationalReports = {
  readonly closures: ReportSection<readonly CashClosureReportResponse[]>;
  readonly audit: ReportSection<readonly AuditReportResponse[]>;
  readonly fiscal: ReportSection<FiscalOperationsReportResponse>;
};
type ReportFilters = { from: string; to: string; limit: string; cashRegisterId: string };
type ReportsApi = Pick<OperationApi, 'getCashClosureReport' | 'getAuditReport' | 'getFiscalOperationsReport'>;

export const toReportQuery = (filters: ReportFilters): ReportQuery => ({
  ...(filters.from ? { from: new Date(filters.from + 'T00:00:00.000Z').toISOString() } : {}),
  ...(filters.to ? { to: new Date(filters.to + 'T23:59:59.999Z').toISOString() } : {}),
  ...(filters.limit.trim() ? { limit: Number(filters.limit) } : {})
});

export const loadOperationalReports = async (
  api: ReportsApi,
  filters: ReportFilters
): Promise<OperationalReports> => {
  const query = toReportQuery(filters);
  const [closures, audit, fiscal] = await Promise.all([
    section(() => api.getCashClosureReport({
      ...query, ...(filters.cashRegisterId.trim() ? { cashRegisterId: filters.cashRegisterId.trim() } : {})
    })),
    section(() => api.getAuditReport(query)),
    section(() => api.getFiscalOperationsReport(query))
  ]);
  return { closures, audit, fiscal };
};

export const toCsv = (rows: readonly (readonly string[])[]): string => rows
  .map((row) => row.map((value) => '"' + (/^[=+\-@]/.test(value) ? "'" + value : value).replace(/"/g, '""') + '"').join(','))
  .join('\n');

const downloadCsv = (fileName: string, rows: readonly (readonly string[])[]): void => {
  if (typeof document === 'undefined') return;
  const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};

export const ReportsScreen = ({ api, capabilities, permissionCodes }: ScreenProps): React.JSX.Element => {
  const today = new Date().toISOString().slice(0, 10);
  const [filters, setFilters] = useState<ReportFilters>({ from: '', to: '', limit: '', cashRegisterId: '' });
  const [reports, setReports] = useState<OperationalReports | null>(null);
  const [dayId, setDayId] = useState(''); const [businessDate, setBusinessDate] = useState(today); const [reason, setReason] = useState('Cierre operativo'); const [consent, setConsent] = useState(false); const [report, setReport] = useState<Awaited<ReturnType<OperationApi['printXReport']>>['report'] | null>(null); const [error, setError] = useState<unknown>(null); const [loading, setLoading] = useState(false);
  const update = (key: keyof ReportFilters) => (event: React.ChangeEvent<HTMLInputElement>): void =>
    setFilters((current) => ({ ...current, [key]: event.target.value }));
  const query = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault(); setLoading(true); setError(null);
    try { setReports(await loadOperationalReports(api, filters)); } catch (nextError) { setError(nextError); } finally { setLoading(false); }
  };
  const print = async (type: 'X' | 'Z'): Promise<void> => { if (!consent) return; setLoading(true); setError(null); try { const response = type === 'X' ? await api.printXReport({ dayId: dayId.trim(), businessDate, reason: reason.trim(), simulationConsent: 'ALLOW_SIMULATED_X_AND_Z' }, createIdempotencyKey()) : await api.printZReport({ dayId: dayId.trim(), businessDate, reason: reason.trim(), simulationConsent: 'ALLOW_SIMULATED_X_AND_Z' }, createIdempotencyKey()); setReport(response.report); } catch (nextError) { setError(nextError); } finally { setConsent(false); setLoading(false); } };
  const closures = reports?.closures; const audit = reports?.audit; const fiscal = reports?.fiscal;
  return <div className="operation-screen"><ScreenNote>Las consultas son de lectura autorizada y no modifican agregados. X y Z solo aparecen como simulación cuando la capacidad está habilitada.</ScreenNote><Feedback error={error} notice={null} onDismiss={() => setError(null)} /><section className="panel"><p className="eyebrow">Período consultado</p><h3>Filtros en UTC</h3><form className="stack-form" onSubmit={query}><div className="form-grid"><label>Desde (UTC)<input type="date" value={filters.from} onChange={update('from')} /></label><label>Hasta (UTC)<input type="date" value={filters.to} onChange={update('to')} /></label><label>Caja (opcional)<input value={filters.cashRegisterId} onChange={update('cashRegisterId')} placeholder="Identificador de caja" /></label><label>Filas (máximo 500)<input type="number" min="1" max="500" value={filters.limit} onChange={update('limit')} placeholder="100" /></label></div><ActionButton className="primary-button" type="submit" busy={loading} disabled={loading}>{loading ? 'Consultando…' : 'Consultar reportes'}</ActionButton></form></section>{closures && <section className="panel"><p className="eyebrow">Caja</p><h3>Cierres y diferencias</h3>{closures.ok ? <>{closures.value.length === 0 ? <EmptyState>Sin turnos en el período consultado.</EmptyState> : <><div className="table-wrap"><table><thead><tr><th>Turno</th><th>Caja</th><th>Apertura</th><th>Cierre</th><th>Movimientos</th><th>Diferencias</th></tr></thead><tbody>{closures.value.map((entry) => <tr key={entry.shiftId}><td>{entry.shiftId}</td><td>{entry.cashRegisterId}</td><td>{new Date(entry.openedAt).toLocaleString('es-VE')}</td><td>{entry.closedAt ? new Date(entry.closedAt).toLocaleString('es-VE') : 'Turno abierto'}</td><td>{entry.movementCount}</td><td>{entry.balances.length === 0 ? '—' : entry.balances.map((balance) => balance.paymentMethodCode + ' ' + money(balance.differenceMinorUnits, balance.currencyCode)).join(' · ')}</td></tr>)}</tbody></table></div><div className="button-row"><button type="button" onClick={() => downloadCsv('cierres-de-caja.csv', [['turno', 'caja', 'apertura', 'cierre', 'movimientos', 'metodo', 'moneda', 'esperado', 'declarado', 'diferencia'], ...closures.value.flatMap((entry) => entry.balances.length === 0 ? [[entry.shiftId, entry.cashRegisterId, entry.openedAt, entry.closedAt ?? '', String(entry.movementCount), '', '', '', '', '']] : entry.balances.map((balance) => [entry.shiftId, entry.cashRegisterId, entry.openedAt, entry.closedAt ?? '', String(entry.movementCount), balance.paymentMethodCode, balance.currencyCode, String(balance.expectedMinorUnits), String(balance.declaredMinorUnits), String(balance.differenceMinorUnits)]))])}>Exportar CSV visible</button></div></>}</> : <SectionError error={closures.error} />}</section>}{audit && <section className="panel"><p className="eyebrow">Auditoría</p><h3>Operaciones sensibles</h3>{audit.ok ? <>{audit.value.length === 0 ? <EmptyState>Sin entradas de auditoría en el período consultado.</EmptyState> : <><div className="table-wrap"><table><thead><tr><th>Fecha UTC</th><th>Actor</th><th>Acción</th><th>Entidad</th><th>Motivo</th><th>Terminal</th><th>Correlación</th></tr></thead><tbody>{audit.value.map((entry) => <tr key={entry.auditId}><td>{entry.occurredAt}</td><td>{entry.actorId}</td><td>{entry.action}</td><td>{entry.entityType} · {entry.entityId}</td><td>{entry.reason}</td><td>{entry.terminalId}</td><td>{entry.correlationId}</td></tr>)}</tbody></table></div><p className="muted">La auditoría no expone el contenido antes/después del agregado; ese resumen permanece en el ledger.</p><div className="button-row"><button type="button" onClick={() => downloadCsv('auditoria.csv', [['fechaUtc', 'actor', 'roles', 'accion', 'entidad', 'entidadId', 'motivo', 'terminal', 'nodo', 'correlacion'], ...audit.value.map((entry) => [entry.occurredAt, entry.actorId, entry.actorRoleCodes.join(' '), entry.action, entry.entityType, entry.entityId, entry.reason, entry.terminalId, entry.originNodeId, entry.correlationId])])}>Exportar CSV visible</button></div></>}</> : <SectionError error={audit.error} />}</section>}{fiscal && <section className="panel"><p className="eyebrow">Fiscalidad</p><h3>Operaciones y estados recuperables</h3>{fiscal.ok ? <>{fiscal.value.operations.length === 0 ? <EmptyState>Sin operaciones fiscales en el período consultado.</EmptyState> : <><div className="table-wrap"><table><thead><tr><th>Tipo</th><th>Identificador</th><th>Operación</th><th>Estado</th><th>Intentos</th><th>Número</th><th>Error</th><th>Evidencia</th></tr></thead><tbody>{fiscal.value.operations.map((entry) => <tr key={entry.kind + entry.id}><td>{entry.kind === 'DOCUMENT' ? 'Documento' : 'Reporte'}</td><td>{entry.id}</td><td>{entry.operationType}</td><td>{entry.status}</td><td>{entry.attempts}</td><td>{entry.fiscalNumber ?? '—'}</td><td>{entry.lastErrorCode ?? '—'}</td><td>{entry.evidence ? Object.entries(entry.evidence).map(([axis, value]) => axis + '=' + value).join(' · ') : 'Sin evidencia'}</td></tr>)}</tbody></table></div><span className="simulation-label">SIMULACIÓN · {fiscal.value.fiscalMode} · no son documentos fiscales legales</span><div className="button-row"><button type="button" onClick={() => downloadCsv('operaciones-fiscales.csv', [['tipo', 'id', 'referencia', 'jornada', 'operacion', 'estado', 'intentos', 'numero', 'error', 'solicitadoUtc', 'modo'], ...fiscal.value.operations.map((entry) => [entry.kind, entry.id, entry.referenceId ?? '', entry.dayId ?? '', entry.operationType, entry.status, String(entry.attempts), entry.fiscalNumber ?? '', entry.lastErrorCode ?? '', entry.requestedAt, fiscal.value.fiscalMode])])}>Exportar CSV visible</button></div></>}</> : <SectionError error={fiscal.error} />}</section>}{capabilities.simulatedReportsEnabled ? <section className="panel"><p className="eyebrow">Acciones fiscales simuladas</p><h3>Reportes X y Z</h3><p className="muted">Estas acciones no son consultas: ejecutan el simulador y quedan registradas. La jornada y la fecha de negocio se capturan aquí porque la API no publica una lectura de jornada actual.</p><div className="form-grid"><label>Día fiscal<input value={dayId} onChange={(event) => setDayId(event.target.value)} placeholder="Identificador del día" required /></label><label>Fecha de negocio<input type="date" value={businessDate} onChange={(event) => setBusinessDate(event.target.value)} required /></label></div><label>Motivo<input value={reason} onChange={(event) => setReason(event.target.value)} required /></label><label className="consent"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /> Confirmo que ejecutaré una simulación y que su resultado no es un cierre fiscal legal.</label><div className="button-row"><ActionButton type="button" onClick={() => void print('X')} busy={loading} disabled={loading || !consent || !dayId.trim() || !reason.trim() || !isPermissionGranted(printSimulatedXReportContract.permission, permissionCodes)}>Solicitar X simulado</ActionButton><ActionButton className="primary-button" type="button" onClick={() => void print('Z')} busy={loading} disabled={loading || !consent || !dayId.trim() || !reason.trim() || !isPermissionGranted(printSimulatedZReportContract.permission, permissionCodes)}>Solicitar Z simulado</ActionButton></div></section> : <section className="panel"><p className="eyebrow">Acciones fiscales simuladas</p><h3>Reportes X y Z</h3><p className="muted">Los reportes simulados están deshabilitados por la configuración del nodo; esta estación no muestra la acción.</p></section>}{report && <section className="panel"><p className="eyebrow">Resultado del simulador</p><h3>Reporte {report.type} · {report.status}</h3><dl className="detail-grid"><div><dt>ID</dt><dd>{report.id}</dd></div><div><dt>Intentos</dt><dd>{report.attempts}</dd></div><div><dt>Número</dt><dd>{report.reportNumber ?? 'Pendiente'}</dd></div><div><dt>Último error</dt><dd>{report.lastErrorCode ?? '—'}</dd></div></dl><span className="simulation-label">SIMULACIÓN · no es documento fiscal legal</span></section>}<section className="panel"><p className="eyebrow">Sincronización</p><h3>Estado del nodo</h3><p className="muted">La sincronización offline-first pertenece a la Fase 10. Esta pantalla no inventa pendientes ni estados de red.</p></section></div>;
};
