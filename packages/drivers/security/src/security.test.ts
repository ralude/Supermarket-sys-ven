import { describe, expect, it } from 'vitest';
import { CryptoSessionTokenService, ScryptPinHasher, UuidV7Generator } from './index.js';

describe('security adapters', () => {
  it('hashes PINs and rejects a different PIN', async () => {
    const hasher = new ScryptPinHasher();
    const encoded = await hasher.hash('123456');
    await expect(hasher.verify('123456', encoded)).resolves.toBe(true);
    await expect(hasher.verify('654321', encoded)).resolves.toBe(false);
  });

  it('generates opaque tokens while exposing only a stable digest', () => {
    const tokens = new CryptoSessionTokenService();
    const first = tokens.generate();
    const second = tokens.generate();
    expect(first.raw).not.toBe(second.raw);
    expect(first.hash).toBe(tokens.hash(first.raw));
    expect(first.hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('generates UUIDv7 identifiers', () => {
    expect(new UuidV7Generator().generate()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
  });
});

