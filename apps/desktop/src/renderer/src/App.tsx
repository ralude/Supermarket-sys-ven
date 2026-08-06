export const App = (): React.JSX.Element => {
  const platform = typeof window === 'undefined' ? 'unknown' : window.desktop?.platform ?? 'unknown';

  return (
    <main className="desktop-shell">
      <section className="welcome-card" aria-labelledby="welcome-title">
        <p className="eyebrow">Supermarket Platform</p>
        <h1 id="welcome-title">Estacion lista</h1>
        <p className="description">
          El renderer React esta aislado del proceso principal y preparado para consumir la API de negocio.
        </p>
        <dl className="runtime-details">
          <div>
            <dt>Entorno</dt>
            <dd>Electron</dd>
          </div>
          <div>
            <dt>Plataforma</dt>
            <dd>{platform}</dd>
          </div>
        </dl>
      </section>
    </main>
  );
};
