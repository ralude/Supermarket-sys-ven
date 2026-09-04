import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ApiProblemError, type DesktopApi } from './api-client.js';
import { AppView, loadInitialState, resolveRoute, type AppViewState } from './App.js';

const render = (state: AppViewState, route = '#/'): string => renderToStaticMarkup(
  <AppView
    state={state}
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
      .resolves.toEqual({ kind: 'signed-out', message: null });
    await expect(loadInitialState(apiWith(async () => { throw new TypeError('network'); })))
      .resolves.toEqual({ kind: 'error' });
  });

  it('renders an explicit startup state', () => {
    expect(render({ kind: 'loading' })).toContain('Conectando con el nodo');
  });

  it('renders the native login form without a token field', () => {
    const markup = render({ kind: 'signed-out', message: null });

    expect(markup).toContain('Ingresar a la estación');
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
});
