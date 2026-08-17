import { DomainError } from '@supermarket/shared';

export type UnitOfMeasureProps = {
  id: string;
  code: string;
  name: string;
  quantityScale: number;
  isActive?: boolean;
};

const UNIT_CODE_PATTERN = /^[A-Z][A-Z0-9_-]*$/;

export class UnitOfMeasure {
  private constructor(
    readonly id: string,
    readonly code: string,
    readonly name: string,
    readonly quantityScale: number,
    readonly isActive: boolean
  ) {}

  static create(props: UnitOfMeasureProps): UnitOfMeasure {
    const code = props.code.trim().toUpperCase();
    if (!UNIT_CODE_PATTERN.test(code)) {
      throw new DomainError(
        'UNIT_OF_MEASURE_INVALID_CODE',
        'Unit of measure code is invalid.'
      );
    }

    const name = props.name.trim();
    if (name.length === 0) {
      throw new DomainError(
        'UNIT_OF_MEASURE_NAME_REQUIRED',
        'Unit of measure name is required.'
      );
    }

    if (
      !Number.isInteger(props.quantityScale) ||
      props.quantityScale < 0 ||
      props.quantityScale > 6
    ) {
      throw new DomainError(
        'UNIT_OF_MEASURE_INVALID_SCALE',
        'Unit quantity scale must be an integer between 0 and 6.'
      );
    }

    return new UnitOfMeasure(
      props.id,
      code,
      name,
      props.quantityScale,
      props.isActive ?? true
    );
  }
}
