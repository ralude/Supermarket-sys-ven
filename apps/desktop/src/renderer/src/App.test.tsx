import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ApiProblemError, type DesktopApi } from './api-client.js';
import {
  AppView, PRODUCT_NAME, isRouteReachable, loadInitialState, resolveRoute, shortcutHash,
  type AppViewState, type NodeConnection
} from './App.js';

const render = (state: AppViewState, route = '#/', connection: NodeConnection = 'online'): string => renderToStaticMarkup(
  <AppView
    state={state}
    connection={connection}
    route={resolveRoute(route)}
    platform="win32"
    operatorCode=""
    pin=""
    onOperatorCodeChange={() => undefined}
    onPinChange={() => undefined}
    onLogin={() => undefined}
    onLogout={() => undefined}
    onRetry={() => undefined}
  />
);

describe('desktop renderer base states', () => {
  const apiWith = (currentSession: DesktopApi['currentSession']): DesktopApi => ({
    currentSession,
    capabilities: async () => ({ fiscalMode: 'SIMULATION', simulatedReportsEnabled: false }),
    login: async () => { throw new Error('not used'); },
    logout: async () => undefined
  });

  it('derives signed-out and connection-error states during startup', async () => {
    const unauthorized = new ApiProblemError({
      type: 'urn:supermarket:problem:unauthorized', title: 'Session is invalid.',
      status: 401, code: 'UNAUTHORIZED', correlationId: 'correlation-1'
    });

    await expect(loadInitialState(apiWith(async () => { throw unauthorized; })))
      .resolves.toEqual({ state: { kind: 'signed-out', message: null }, connection: 'online' });
    await expect(loadInitialState(apiWith(async () => { throw new TypeError('network'); })))
      .resolves.toEqual({ state: { kind: 'error' }, connection: 'offline' });
  });

  it('distinguishes a server response from a genuine transport failure', async () => {
    const forbidden = new ApiProblemError({
      type: 'urn:supermarket:problem:forbidden', title: 'Forbidden.',
      status: 403, code: 'FORBIDDEN', correlationId: 'correlation-2'
    });

    // El servidor respondió (aunque con un error de negocio): la conexión es real.
    await expect(loadInitialState(apiWith(async () => { throw forbidden; })))
      .resolves.toMatchObject({ connection: 'online' });
    // El fetch nunca llegó a completarse: no hay conexión con el nodo.
    await expect(loadInitialState(apiWith(async () => { throw new Error('ECONNREFUSED'); })))
      .resolves.toMatchObject({ connection: 'offline' });
  });

  it('renders an explicit startup state', () => {
    expect(render({ kind: 'loading' })).toContain('Conectando con el nodo');
  });

  it('renders the native login form without a token field', () => {
    const markup = render({ kind: 'signed-out', message: null });

    expect(markup).toContain(`Ingresar a ${PRODUCT_NAME}`);
    expect(markup).toContain('type="password"');
    expect(markup).toContain('autoComplete="current-password"');
    expect(markup).not.toContain('name="token"');
  });

  it('renders a recoverable connection error', () => {
    const markup = render({ kind: 'error' });

    expect(markup).toContain('No pudimos conectar con el nodo');
    expect(markup).toContain('Reintentar');
    expect(markup).toContain('role="alert"');
  });

  it('renders the authenticated shell and resolves hash navigation', () => {
    const state: AppViewState = {
      kind: 'ready',
      session: {
        actorId: 'user-1', displayName: 'Operador Uno', roleCodes: ['cashier'],
        permissionCodes: [],
        idleExpiresAt: '2026-09-02T18:00:00.000Z',
        absoluteExpiresAt: '2026-09-03T00:00:00.000Z'
      },
      capabilities: { fiscalMode: 'SIMULATION', simulatedReportsEnabled: false }
    };
    const markup = render(state, '#/catalog');

    expect(markup).toContain('Operador Uno');
    expect(markup).toContain('SIMULACIÓN');
    expect(markup).toContain('Servidor conectado');
    expect(markup).toContain('Catálogo');
    expect(markup).toContain('aria-current="page"');
    expect(markup).toContain('win32');
    expect(resolveRoute('#/unknown').id).toBe('home');
  });

  it('publishes the product name and drops the sub-phase label from the shell', () => {
    const state: AppViewState = {
      kind: 'ready',
      session: {
        actorId: 'user-1', displayName: 'Operador Uno', roleCodes: ['cashier'],
        permissionCodes: [],
        idleExpiresAt: '2026-09-02T18:00:00.000Z',
        absoluteExpiresAt: '2026-09-03T00:00:00.000Z'
      },
      capabilities: { fiscalMode: 'SIMULATION', simulatedReportsEnabled: false }
    };
    const markup = render(state, '#/sales');

    expect(PRODUCT_NAME).toBe('Cullen');
    expect(markup).toContain(PRODUCT_NAME);
    expect(markup).not.toContain('Subfase');
    expect(markup).not.toMatch(/9.0d/u);
  });

  it('maps the numeric shortcuts to their routes', () => {
    expect(shortcutHash('2')).toBe('#/sales');
    expect(resolveRoute(shortcutHash('2') ?? '#/').id).toBe('sales');
    expect(shortcutHash('9')).toBeNull();
  });

  it('reaches every operational screen with no permission at all, since each one has a read open to any valid session', () => {
    const noPermission: readonly string[] = [];
    expect(isRouteReachable(resolveRoute('#/sales'), noPermission)).toBe(true);
    expect(isRouteReachable(resolveRoute('#/cash'), noPermission)).toBe(true);
    expect(isRouteReachable(resolveRoute('#/catalog'), noPermission)).toBe(true);
    expect(isRouteReachable(resolveRoute('#/inventory'), noPermission)).toBe(true);
    expect(isRouteReachable(resolveRoute('#/rates'), noPermission)).toBe(true);
  });

  it('gates the screens whose whole purpose is a command behind their permissions', () => {
    const noPermission: readonly string[] = [];
    expect(isRouteReachable(resolveRoute('#/reports'), noPermission)).toBe(false);
    expect(isRouteReachable(resolveRoute('#/reports'), ['reports.audit.read'])).toBe(true);
    expect(isRouteReachable(resolveRoute('#/suppliers'), noPermission)).toBe(false);
    expect(isRouteReachable(resolveRoute('#/suppliers'), ['supplier.update'])).toBe(true);
  });

  it('hides the Reportes entry and blocks the hash without a report permission, without touching the server', () => {
    const state: AppViewState = {
      kind: 'ready',
      session: {
        actorId: 'user-1', displayName: 'Operador Uno', roleCodes: ['cashier'],
        permissionCodes: [],
        idleExpiresAt: '2026-09-02T18:00:00.000Z',
        absoluteExpiresAt: '2026-09-03T00:00:00.000Z'
      },
      capabilities: { fiscalMode: 'SIMULATION', simulatedReportsEnabled: false }
    };
    const markup = render(state, '#/reports');

    expect(markup).not.toContain('>Reportes<');
    expect(markup).toContain('No tienes autorización para esta pantalla');
  });

  it('shows the Reportes entry and the screen once the session holds any one report permission', () => {
    const state: AppViewState = {
      kind: 'ready',
      session: {
        actorId: 'user-1', displayName: 'Operador Uno', roleCodes: ['supervisor'],
        permissionCodes: ['reports.cash.read'],
        idleExpiresAt: '2026-09-02T18:00:00.000Z',
        absoluteExpiresAt: '2026-09-03T00:00:00.000Z'
      },
      capabilities: { fiscalMode: 'SIMULATION', simulatedReportsEnabled: false }
    };
    const markup = render(state, '#/reports');

    expect(markup).toContain('>Reportes<');
    expect(markup).not.toContain('No tienes autorización para esta pantalla');
  });

  it('shows the connection badge derived from state, not as fixed markup', () => {
    const state: AppViewState = {
      kind: 'ready',
      session: {
        actorId: 'user-1', displayName: 'Operador Uno', roleCodes: ['cashier'],
        permissionCodes: [],
        idleExpiresAt: '2026-09-02T18:00:00.000Z',
        absoluteExpiresAt: '2026-09-03T00:00:00.000Z'
      },
      capabilities: { fiscalMode: 'SIMULATION', simulatedReportsEnabled: false }
    };

    expect(render(state, '#/', 'online')).toContain('Servidor conectado');
    expect(render(state, '#/', 'offline')).toContain('Sin conexión con el nodo');
    expect(render(state, '#/', 'offline')).not.toContain('Servidor conectado');
  });
});
