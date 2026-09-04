import { describe, expect, it } from 'vitest';
import { isPermissionGranted } from './common.contracts.js';

describe('isPermissionGranted', () => {
  it('grants access when the contract requires no permission, regardless of the session', () => {
    expect(isPermissionGranted(null, [])).toBe(true);
    expect(isPermissionGranted(null, ['catalog.product.create'])).toBe(true);
  });

  it('grants access only when the session holds the single required permission', () => {
    expect(isPermissionGranted('cash.shift.open', ['cash.shift.open'])).toBe(true);
    expect(isPermissionGranted('cash.shift.open', ['cash.shift.close'])).toBe(false);
    expect(isPermissionGranted('cash.shift.open', [])).toBe(false);
  });

  it('grants access when the session holds any one of an alternative pair', () => {
    const required = 'cash.movement.income|cash.movement.withdrawal';
    expect(isPermissionGranted(required, ['cash.movement.income'])).toBe(true);
    expect(isPermissionGranted(required, ['cash.movement.withdrawal'])).toBe(true);
    expect(isPermissionGranted(required, ['cash.movement.income', 'cash.movement.withdrawal'])).toBe(true);
    expect(isPermissionGranted(required, ['sale.void'])).toBe(false);
    expect(isPermissionGranted(required, [])).toBe(false);
  });
});
