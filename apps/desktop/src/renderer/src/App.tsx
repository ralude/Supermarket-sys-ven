import { Component, useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import type { CapabilitiesResponse, SessionResponse } from '@supermarket/shared';
import { ApiProblemError, createDesktopApi, type DesktopApi, type OperationApi } from './api-client.js';
import { routeScreen } from './operation-screens.js';

export const PRODUCT_NAME = 'Cullen';

type AppRoute = {
  readonly id: string;
  readonly hash: string;
  readonly label: string;
  readonly title: string;
  readonly shortcut: string;
  readonly description: string;
};

const ROUTES: readonly AppRoute[] = [
  {
    id: 'home', hash: '#/', label: 'Inicio', title: 'Inicio', shortcut: '1',
    description: 'Resumen de la estación y accesos directos a la operación diaria.'
  },
  {
    id: 'sales', hash: '#/sales', label: 'Venta', title: 'Punto de venta', shortcut: '2',
    description: 'Escanea productos, cobra y completa la venta del turno abierto.'
  },
  {
    id: 'cash', hash: '#/cash', label: 'Caja', title: 'Operación de caja', shortcut: '3',
    description: 'Apertura de turno, movimientos de efectivo y cierre con arqueo.'
  },
  {
    id: 'catalog', hash: '#/catalog', label: 'Catálogo', title: 'Catálogo', shortcut: '4',
    description: 'Consulta productos por barcode y administra precios auditados.'
  },
  {
    id: 'inventory', hash: '#/inventory', label: 'Inventario', title: 'Inventario', shortcut: '5',
    description: 'Kardex, recepciones de compra y ajustes autorizados de existencia.'
  },
  {
    id: 'reports', hash: '#/reports', label: 'Reportes', title: 'Reportes y cierres', shortcut: '6',
    description: 'Cierres de caja, auditoría y estados fiscales del período.'
  },
  {
    id: 'rates', hash: '#/rates', label: 'Tasas', title: 'Tasas de cambio', shortcut: '7',
    description: 'Tasa vigente, histórico local y confirmación de sugerencias externas.'
  }
];

export const resolveRoute = (hash: string): AppRoute =>
  ROUTES.find((route) => route.hash === hash) ?? ROUTES[0]!;

/** Atajo de teclado del POS: Alt + dígito lleva a la pantalla correspondiente. */
export const shortcutHash = (key: string): string | null =>
  ROUTES.find((route) => route.shortcut === key)?.hash ?? null;

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

/**
 * Evita que un fallo de render deje la ventana en blanco: aísla la pantalla
 * activa y ofrece recuperación sin reiniciar la estación.
 */
export class ScreenErrorBoundary extends Component<
  { readonly children: ReactNode },
  { readonly failed: boolean }
> {
  override state = { failed: false };

  static getDerivedStateFromError(): { readonly failed: boolean } {
    return { failed: true };
  }

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="panel" role="alert">
        <h2>No pudimos dibujar esta pantalla</h2>
        <p className="muted">
          La operación en el nodo no se vio afectada. Vuelve a intentarlo o cambia de pantalla.
        </p>
        <div className="button-row">
          <button
            className="primary-button"
            type="button"
            onClick={() => this.setState({ failed: false })}
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }
}

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
  <div className="brand" aria-label={PRODUCT_NAME}>
    <span className="brand-mark" aria-hidden="true">CU</span>
    <span><strong>{PRODUCT_NAME}</strong><small>Punto de venta</small></span>
  </div>
);

const HomeScreen = ({ capabilities }: {
  readonly capabilities: CapabilitiesResponse;
}): React.JSX.Element => (
  <div className="operation-screen">
    <p className="screen-note">
      {PRODUCT_NAME} está conectado al nodo local. Elige una operación para comenzar.
    </p>
    <nav className="quick-actions" aria-label="Accesos directos">
      {ROUTES.filter((item) => item.id !== 'home').map((item) => (
        <a key={item.id} className="quick-action" href={item.hash}>
          <span className="quick-action-key" aria-hidden="true">Alt+{item.shortcut}</span>
          <strong>{item.label}</strong>
          <small>{item.description}</small>
        </a>
      ))}
    </nav>
    <section className="panel" aria-labelledby="station-status-title">
      <h2 id="station-status-title">Estado de la estación</h2>
      <dl className="detail-grid">
        <div><dt>Sesión</dt><dd>Activa</dd></div>
        <div><dt>API</dt><dd>v1</dd></div>
        <div><dt>Modo fiscal</dt><dd>{capabilities.fiscalMode}</dd></div>
        <div>
          <dt>Reportes X/Z</dt>
          <dd>{capabilities.simulatedReportsEnabled ? 'Simulados habilitados' : 'Deshabilitados'}</dd>
        </div>
      </dl>
    </section>
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
      <main className="centered-state" aria-live="polite" aria-busy="true">
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
          <h1 id="access-title">Ingresar a {PRODUCT_NAME}</h1>
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
              title={item.description}
            >
              <span>{item.label}</span>
              <kbd aria-hidden="true">Alt+{item.shortcut}</kbd>
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
            <h1 id="workspace-title">{route.title}</h1>
            <p className="topbar-hint">{route.description}</p>
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
          <ScreenErrorBoundary key={route.id}>
            {(api
              ? routeScreen(route.id, { api: api as OperationApi, capabilities: state.capabilities })
              : null) ?? <HomeScreen capabilities={state.capabilities} />}
          </ScreenErrorBoundary>
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
  useEffect(() => {
    const navigate = (event: KeyboardEvent): void => {
      if (!event.altKey || event.ctrlKey || event.metaKey) return;
      const hash = shortcutHash(event.key);
      if (!hash) return;
      event.preventDefault();
      window.location.hash = hash;
    };
    window.addEventListener('keydown', navigate);
    return () => window.removeEventListener('keydown', navigate);
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
