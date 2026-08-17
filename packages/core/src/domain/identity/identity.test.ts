import { describe, expect, it } from 'vitest';
import { Permission } from './permission.js';
import { Role } from './role.js';
import { User } from './user.js';

function permission(overrides: Partial<Parameters<typeof Permission.create>[0]> = {}): Permission {
  return Permission.create({
    code: ' cash.shift.open ',
    name: ' Open shift ',
    ...overrides
  });
}

function role(overrides: Partial<Parameters<typeof Role.create>[0]> = {}): Role {
  return Role.create({
    id: 'role-cashier',
    code: ' cashier ',
    name: ' Cashier ',
    permissions: [permission()],
    ...overrides
  });
}

describe('identity domain', () => {
  it('normalizes stable permission and role codes', () => {
    const createdPermission = permission();
    const createdRole = role();

    expect(createdPermission.code).toBe('cash.shift.open');
    expect(createdPermission.name).toBe('Open shift');
    expect(createdRole.code).toBe('CASHIER');
    expect(createdRole.name).toBe('Cashier');
  });

  it('rejects invalid, duplicate, inactive or non-assignable permissions', () => {
    expect(() => permission({ code: 'Cash Shift Open' })).toThrowError('Permission code is invalid.');
    expect(() => role({
      permissions: [permission(), permission({ name: 'Duplicate permission' })]
    })).toThrowError('Role permissions must be unique.');
    expect(() => role({
      permissions: [permission({ isActive: false })]
    })).toThrowError('Only active and assignable permissions can be assigned to a role.');
    expect(() => role({
      permissions: [permission({ isAssignable: false })]
    })).toThrowError('Only active and assignable permissions can be assigned to a role.');
  });

  it('inherits permissions from multiple roles and supports revocation', () => {
    const cashRole = role();
    const salesPermission = permission({ code: 'sale.void', name: 'Void sale' });
    const salesRole = role({
      id: 'role-supervisor',
      code: 'supervisor',
      name: 'Supervisor',
      permissions: [salesPermission]
    });
    const user = User.create({
      id: 'user-001',
      displayName: ' Cashier One ',
      roles: [cashRole, salesRole]
    });

    expect(user.displayName).toBe('Cashier One');
    expect(user.hasPermission('cash.shift.open')).toBe(true);
    expect(user.hasPermission('sale.void')).toBe(true);

    user.removeRole(salesRole.id);

    expect(user.hasPermission('sale.void')).toBe(false);
    expect(user.roles).toEqual([cashRole]);
  });

  it('rejects duplicate, inactive or non-assignable roles', () => {
    const cashier = role();
    const user = User.create({ id: 'user-001', displayName: 'Cashier', roles: [cashier] });

    expect(() => user.assignRole(cashier)).toThrowError('User roles must be unique.');
    expect(() => user.assignRole(role({ id: 'role-inactive', code: 'inactive', isActive: false })))
      .toThrowError('Only active and assignable roles can be assigned to a user.');
    expect(() => user.assignRole(role({ id: 'role-system', code: 'system', isAssignable: false })))
      .toThrowError('Only active and assignable roles can be assigned to a user.');
  });

  it('denies access when the user, role or permission is inactive and restores it on activation', () => {
    const openShift = permission();
    const cashier = role({ permissions: [openShift] });
    const user = User.create({ id: 'user-001', displayName: 'Cashier', roles: [cashier] });

    openShift.deactivate();
    expect(user.hasPermission(openShift.code)).toBe(false);
    openShift.activate();
    expect(user.hasPermission(openShift.code)).toBe(true);

    cashier.deactivate();
    expect(user.hasPermission(openShift.code)).toBe(false);
    cashier.activate();
    expect(user.hasPermission(openShift.code)).toBe(true);

    user.deactivate();
    expect(user.hasPermission(openShift.code)).toBe(false);
    user.activate();
    expect(user.hasPermission(openShift.code)).toBe(true);
  });

  it('returns defensive role and permission collections', () => {
    const cashier = role();
    const user = User.create({ id: 'user-001', displayName: 'Cashier', roles: [cashier] });
    const exposedRoles = user.roles as Role[];
    const exposedPermissions = cashier.permissions as Permission[];

    exposedRoles.length = 0;
    exposedPermissions.length = 0;

    expect(user.roles).toHaveLength(1);
    expect(cashier.permissions).toHaveLength(1);
  });
});
