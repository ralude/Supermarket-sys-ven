import { DomainError } from '@supermarket/shared';

export type BarcodeProps = {
  id: string;
  value: string;
  isActive?: boolean;
};

const BARCODE_PATTERN = /^[A-Z0-9]+$/;

export class Barcode {
  private constructor(
    readonly id: string,
    readonly value: string,
    readonly isActive: boolean
  ) {}

  static create(props: BarcodeProps): Barcode {
    const value = props.value.trim().toUpperCase();
    if (value.length === 0) {
      throw new DomainError('BARCODE_REQUIRED', 'Barcode is required.');
    }

    if (!BARCODE_PATTERN.test(value)) {
      throw new DomainError(
        'BARCODE_INVALID_FORMAT',
        'Barcode must contain only letters and digits.'
      );
    }

    return new Barcode(props.id, value, props.isActive ?? true);
  }
}
