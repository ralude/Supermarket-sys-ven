import { DomainError } from '@supermarket/shared';

export type BatchProps = {
  id: string;
  lotNumber: string;
  expiresAt?: Date;
};

export class Batch {
  private readonly expirationTimestamp: Date | null;

  private constructor(
    readonly id: string,
    readonly lotNumber: string,
    expiresAt: Date | null
  ) {
    this.expirationTimestamp = expiresAt === null ? null : new Date(expiresAt);
  }

  static create(props: BatchProps): Batch {
    const id = Batch.requireText(props.id, 'STOCK_BATCH_ID_REQUIRED', 'Stock batch ID is required.');
    const lotNumber = Batch.requireText(
      props.lotNumber,
      'STOCK_BATCH_LOT_REQUIRED',
      'Stock batch lot number is required.'
    ).toUpperCase();
    if (props.expiresAt !== undefined && Number.isNaN(props.expiresAt.getTime())) {
      throw new DomainError('STOCK_BATCH_EXPIRY_INVALID', 'Stock batch expiry is invalid.');
    }
    return new Batch(id, lotNumber, props.expiresAt ?? null);
  }

  get expiresAt(): Date | null {
    return this.expirationTimestamp === null ? null : new Date(this.expirationTimestamp);
  }

  private static requireText(value: string, code: string, message: string): string {
    const normalized = value.trim();
    if (normalized.length === 0) throw new DomainError(code, message);
    return normalized;
  }
}
