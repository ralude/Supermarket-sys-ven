import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { CapabilitiesResponse, SessionResponse } from '@supermarket/shared';
import { ApiProblemError, createDesktopApi, type DesktopApi, type OperationApi } from './api-client.js';
import { routeScreen } from './operation-screens.js';

type AppRoute = {
  readonly id: string;
  readonly hash: string;
  readonly label: string;
  readonly title: string;
  readonly phase: string;
  readonly description: string;
};

const ROUTES: readonly AppRoute[] = [
  {
    id: 'home', hash: '#/', label: 'Inicio', title: 'Estación preparada', phase: '9.01',
    description: 'La base React está conectada y lista para recibir los flujos operativos.'
  },
  {
    id: 'sales', hash: '#/sales', label: 'Venta', title: 'Punto de venta', phase: '9.02',
    description: 'El flujo de venta se habilitará en la subfase 9.02.'
  },
  {
    id: 'cash', hash: '#/cash', label: 'Caja', title: 'Operación de caja', phase: '9.03',
    description: 'Apertura, movimientos y cierre se habilitarán en la subfase 9.03.'
  },
  {
    id: 'catalog', hash: '#/catalog', label: 'Catálogo', title: 'Catálogo', phase: '9.04',
    description: 'La consulta y administración de productos se habilitará en la subfase 9.04.'
  },
  {
    id: 'inventory', hash: '#/inventory', label: 'Inventario', title: 'Inventario', phase: '9.05',
    description: 'Kardex y movimientos autorizados se habilitarán en la subfase 9.05.'
  },
  {
    id: 'reports', hash: '#/reports', label: 'Reportes', title: 'Reportes y cierres', phase: '9.06',
    description: 'Reportes, estados fiscales y cierres se habilitarán en la subfase 9.06.'
  },
  {
    id: 'rates', hash: '#/rates', label: 'Tasas', title: 'Tasas de cambio', phase: '9.07',
    description: 'La tasa vigente, su histórico y sugerencias se habilitarán en la subfase 9.07.'
  }
];

export const resolveRoute = (hash: string): AppRoute =>
  ROUTES.find((route) => route.hash === hash) ?? ROUTES[0]!;

export type AppViewState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'signed-out'; readonly message: string | null }
  | { readonly kind: 'error' }
  | {
    readonly kind: 'ready';
    readonly session: SessionResponse;
    readonly capabilities: CapabilitiesResponse;
  };

export const loadInitialState = async (api: DesktopApi): Promise<AppViewState> => {
  try {
    const session = await api.currentSession();
    const capabilities = await api.capabilities();
    return { kind: 'ready', session, capabilities };
  } catch (error) {
    return error instanceof ApiProblemError && error.problem.status === 401
      ? { kind: 'signed-out', message: null }
      : { kind: 'error' };
  }
};

type AppViewProps = {
  readonly state: AppViewState;
  readonly route: AppRoute;
  readonly platform: string;
  readonly operatorCode: string;
  readonly pin: string;
  readonly onOperatorCodeChange: (value: string) => void;
  readonly onPinChange: (value: string) => void;
  readonly onLogin: (event: FormEvent<HTMLFormElement>) => void;
  readonly onLogout: () => void;
  readonly onRetry: () => void;
  readonly api?: DesktopApi;
};

const Brand = (): React.JSX.Element => (
  <div className="brand" aria-label="Supermarket Platform">
    <span className="brand-mark" aria-hidden="true">SP</span>
    <span><strong>Supermarket</strong><small>Plataforma POS</small></span>
  </div>
);

export const AppView = ({
  state,
  route,
  platform,
  operatorCode,
  pin,
  onOperatorCodeChange,
  onPinChange,
  onLogin,
  onLogout,
  onRetry,
  api
}: AppViewProps): React.JSX.Element => {
  if (state.kind === 'loading') {
    return (
      <main className="centered-state" aria-live="polite">
        <Brand />
        <span className="spinner" aria-hidden="true" />
        <h1>Conectando con el nodo</h1>
        <p>Estamos verificando la sesión local.</p>
      </main>
    );
  }

  if (state.kind === 'error') {
    return (
      <main className="centered-state" role="alert">
        <Brand />
        <span className="state-symbol" aria-hidden="true">!</span>
        <h1>No pudimos conectar con el nodo</h1>
        <p>Comprueba que el servidor local esté iniciado e inténtalo nuevamente.</p>
        <button className="primary-button" type="button" onClick={onRetry}>Reintentar</button>
      </main>
    );
  }

  if (state.kind === 'signed-out') {
    return (
      <main className="access-page">
        <section className="access-intro" aria-labelledby="access-title">
          <Brand />
          <p className="eyebrow">Nodo local · {platform}</p>
          <h1 id="access-title">Ingresar a la estación</h1>
          <p>Usa tu código de operador y PIN. La sesión permanece protegida en una cookie local.</p>
          <span className="simulation-label">Fiscal · SIMULACIÓN</span>
        </section>
        <form className="login-card" onSubmit={onLogin}>
          <div>
            <p className="eyebrow">Acceso operativo</p>
            <h2>Identificación</h2>
          </div>
          <label>
            Código de operador
            <input
              name="operatorCode"
              value={operatorCode}
              onChange={(event) => onOperatorCodeChange(event.target.value)}
              autoComplete="username"
              maxLength={64}
              required
              autoFocus
            />
          </label>
          <label>
            PIN
            <input
              name="pin"
              type="password"
              inputMode="numeric"
              pattern="[0-9]{6,12}"
              minLength={6}
              maxLength={12}
              value={pin}
              onChange={(event) => onPinChange(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          {state.message && <p className="form-error" role="alert">{state.message}</p>}
          <button className="primary-button" type="submit">Ingresar</button>
        </form>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <nav aria-label="Navegación principal">
          {ROUTES.map((item) => (
            <a
              key={item.id}
              href={item.hash}
              aria-current={route.id === item.id ? 'page' : undefined}
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span>Entorno</span>
          <strong>Electron · {platform}</strong>
        </div>
      </aside>
      <main className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Subfase {route.phase}</p>
            <h1>{route.title}</h1>
          </div>
          <div className="topbar-actions">
            <span className="status-label"><i aria-hidden="true" />Servidor conectado</span>
            <span className="simulation-label">Fiscal · SIMULACIÓN</span>
            <div className="account">
              <span><small>Operador</small><strong>{state.session.displayName}</strong></span>
              <button type="button" onClick={onLogout}>Salir</button>
            </div>
          </div>
        </header>
        <section className="workspace-content" aria-labelledby="workspace-title">
          {(api ? routeScreen(route.id, { api: api as OperationApi, capabilities: state.capabilities }) : null) ?? <div className="phase-card">
            <p className="eyebrow">Base operativa</p>
            <h2 id="workspace-title">{route.label}</h2>
            <p>{route.description}</p>
            <dl>
              <div><dt>Sesión</dt><dd>Activa</dd></div>
              <div><dt>API</dt><dd>v1</dd></div>
              <div>
                <dt>Reportes X/Z</dt>
                <dd>{state.capabilities.simulatedReportsEnabled ? 'Simulados habilitados' : 'Deshabilitados'}</dd>
              </div>
            </dl>
          </div>}
        </section>
      </main>
    </div>
  );
};

const defaultApi = createDesktopApi();

export const App = ({ api = defaultApi }: { readonly api?: DesktopApi }): React.JSX.Element => {
  const [state, setState] = useState<AppViewState>({ kind: 'loading' });
  const [operatorCode, setOperatorCode] = useState('');
  const [pin, setPin] = useState('');
  const [route, setRoute] = useState(() => resolveRoute(
    typeof window === 'undefined' ? '#/' : window.location.hash || '#/'
  ));
  const platform = typeof window === 'undefined' ? 'unknown' : window.desktop?.platform ?? 'unknown';

  const loadSession = useCallback(async (): Promise<void> => {
    setState({ kind: 'loading' });
    setState(await loadInitialState(api));
  }, [api]);

  useEffect(() => { void loadSession(); }, [loadSession]);
  useEffect(() => {
    const updateRoute = (): void => setRoute(resolveRoute(window.location.hash || '#/'));
    window.addEventListener('hashchange', updateRoute);
    return () => window.removeEventListener('hashchange', updateRoute);
  }, []);

  const login = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setState({ kind: 'loading' });
    try {
      const session = await api.login({ operatorCode, pin });
      setPin('');
      const capabilities = await api.capabilities();
      setState({ kind: 'ready', session, capabilities });
    } catch (error) {
      setPin('');
      setState(error instanceof ApiProblemError && error.problem.code === 'AUTHENTICATION_FAILED'
        ? { kind: 'signed-out', message: 'Código de operador o PIN incorrecto.' }
        : { kind: 'error' });
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await api.logout();
      setOperatorCode('');
      setPin('');
      setState({ kind: 'signed-out', message: null });
    } catch {
      setState({ kind: 'error' });
    }
  };

  return (
    <AppView
      state={state}
      route={route}
      platform={platform}
      operatorCode={operatorCode}
      pin={pin}
      onOperatorCodeChange={setOperatorCode}
      onPinChange={setPin}
      onLogin={(event) => { void login(event); }}
      onLogout={() => { void logout(); }}
      onRetry={() => { void loadSession(); }}
      api={api}
    />
  );
};
