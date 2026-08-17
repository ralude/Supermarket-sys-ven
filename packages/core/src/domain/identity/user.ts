import { DomainError } from '@supermarket/shared';
import type { Role } from './role.js';

export type UserProps = {
  id: string;
  displayName: string;
  roles?: Role[];
  isActive?: boolean;
};

export class User {
  private currentIsActive: boolean;
  private readonly currentRoles: Role[] = [];

  private constructor(
    readonly id: string,
    readonly displayName: string,
    isActive: boolean
  ) {
    this.currentIsActive = isActive;
  }

  static create(props: UserProps): User {
    const id = User.requireText(props.id, 'USER_ID_REQUIRED', 'User ID is required.');
    const displayName = User.requireText(
      props.displayName,
      'USER_DISPLAY_NAME_REQUIRED',
      'User display name is required.'
    );
    const user = new User(id, displayName, props.isActive ?? true);
    for (const role of props.roles ?? []) user.assignRole(role);
    return user;
  }

  get isActive(): boolean {
    return this.currentIsActive;
  }

  get roles(): readonly Role[] {
    return [...this.currentRoles];
  }

  assignRole(role: Role): void {
    if (!role.isActive || !role.isAssignable) {
      throw new DomainError(
        'USER_ROLE_NOT_ASSIGNABLE',
        'Only active and assignable roles can be assigned to a user.'
      );
    }
    if (this.currentRoles.some((assigned) => assigned.id === role.id || assigned.code === role.code)) {
      throw new DomainError('USER_ROLE_DUPLICATE', 'User roles must be unique.');
    }
    this.currentRoles.push(role);
  }

  removeRole(roleId: string): void {
    const normalized = roleId.trim();
    const index = this.currentRoles.findIndex((role) => role.id === normalized);
    if (index >= 0) this.currentRoles.splice(index, 1);
  }

  hasPermission(permissionCode: string): boolean {
    if (!this.currentIsActive) return false;
    return this.currentRoles.some((role) => role.hasPermission(permissionCode));
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
