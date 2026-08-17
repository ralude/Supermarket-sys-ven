import { DomainError } from '@supermarket/shared';

export type CategoryProps = {
  id: string;
  name: string;
  isActive?: boolean;
};

export class Category {
  private constructor(
    readonly id: string,
    readonly name: string,
    readonly isActive: boolean
  ) {}

  static create(props: CategoryProps): Category {
    const name = props.name.trim();
    if (name.length === 0) {
      throw new DomainError('CATEGORY_NAME_REQUIRED', 'Category name is required.');
    }

    return new Category(props.id, name, props.isActive ?? true);
  }
}
