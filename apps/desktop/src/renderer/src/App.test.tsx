import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App.js';

describe('desktop renderer smoke', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the safe desktop shell', () => {
    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain('Estacion lista');
    expect(markup).toContain('Electron');
  });

  it('renders a visible fallback when the preload bridge is unavailable', () => {
    vi.stubGlobal('window', {});

    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain('unknown');
  });
});
