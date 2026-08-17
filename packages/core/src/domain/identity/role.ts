import { DomainError } from '@supermarket/shared';
import type { Permission } from './permission.js';

export type RoleProps = {
  id: string;
  code: string;
  name: string;
  permissions?: Permission[];
  isActive?: boolean;
  isAssignable?: boolean;
};

const ROLE_CODE_PATTERN = /^[A-Z][A-Z0-9_]*$/;

export class Role {
  private currentIsActive: boolean;
  private readonly currentPermissions: Permission[] = [];

  private constructor(
    readonly id: string,
    readonly code: string,
    readonly name: string,
    isActive: boolean,
    readonly isAssignable: boolean
  ) {
    this.currentIsActive = isActive;
  }

  static create(props: RoleProps): Role {
    const id = Role.requireText(props.id, 'ROLE_ID_REQUIRED', 'Role ID is required.');
    const code = props.code.trim().toUpperCase();
    if (!ROLE_CODE_PATTERN.test(code)) {
      throw new DomainError('ROLE_INVALID_CODE', 'Role code is invalid.');
    }
    const name = Role.requireText(props.name, 'ROLE_NAME_REQUIRED', 'Role name is required.');
    const role = new Role(
      id,
      code,
      name,
      props.isActive ?? true,
      props.isAssignable ?? true
    );
    for (const permission of props.permissions ?? []) role.assignPermission(permission);
    return role;
  }

  get isActive(): boolean {
    return this.currentIsActive;
  }

  get permissions(): readonly Permission[] {
    return [...this.currentPermissions];
  }

  assignPermission(permission: Permission): void {
    if (!permission.isActive || !permission.isAssignable) {
      throw new DomainError(
        'ROLE_PERMISSION_NOT_ASSIGNABLE',
        'Only active and assignable permissions can be assigned to a role.'
      );
    }
    if (this.currentPermissions.some((assigned) => assigned.code === permission.code)) {
      throw new DomainError('ROLE_PERMISSION_DUPLICATE', 'Role permissions must be unique.');
    }
    this.currentPermissions.push(permission);
  }

  removePermission(permissionCode: string): void {
    const normalized = permissionCode.trim().toLowerCase();
    const index = this.currentPermissions.findIndex((permission) => permission.code === normalized);
    if (index >= 0) this.currentPermissions.splice(index, 1);
  }

  hasPermission(permissionCode: string): boolean {
    if (!this.currentIsActive) return false;
    const normalized = permissionCode.trim().toLowerCase();
    return this.currentPermissions.some(
      (permission) => permission.isActive && permission.code === normalized
    );
  }

  activate(): void {
    this.currentIsActive = true;
  }

  deactivate(): void {
    this.currentIsActive = false;
  }

  private static requireText(value: string, code: string, message: string): string {
    const normalized = value.trim();
    if (normalized.length === 0) throw new DomainError(code, message);
    return normalized;
  }
}
