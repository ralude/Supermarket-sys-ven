import { DomainError } from '@supermarket/shared';

export type PermissionProps = {
  code: string;
  name: string;
  isActive?: boolean;
  isAssignable?: boolean;
};

const PERMISSION_CODE_PATTERN = /^[a-z][a-z0-9]*(?:[._][a-z0-9]+)*$/;

export class Permission {
  private currentIsActive: boolean;

  private constructor(
    readonly code: string,
    readonly name: string,
    isActive: boolean,
    readonly isAssignable: boolean
  ) {
    this.currentIsActive = isActive;
  }

  static create(props: PermissionProps): Permission {
    const code = props.code.trim().toLowerCase();
    if (!PERMISSION_CODE_PATTERN.test(code)) {
      throw new DomainError('PERMISSION_INVALID_CODE', 'Permission code is invalid.');
    }

    const name = props.name.trim();
    if (name.length === 0) {
      throw new DomainError('PERMISSION_NAME_REQUIRED', 'Permission name is required.');
    }

    return new Permission(
      code,
      name,
      props.isActive ?? true,
      props.isAssignable ?? true
    );
  }

  get isActive(): boolean {
    return this.currentIsActive;
  }

  activate(): void {
    this.currentIsActive = true;
  }

  deactivate(): void {
    this.currentIsActive = false;
  }
}
