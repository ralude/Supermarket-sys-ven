import type { Money } from '@supermarket/shared';

export type PriceHistoryProps = {
  id: string;
  price: Money;
  recordedAt: Date;
  recordedBy: string;
  reason?: string;
};

export class PriceHistory {
  private constructor(
    readonly id: string,
    readonly price: Money,
    readonly recordedAt: Date,
    readonly recordedBy: string,
    readonly reason: string | null
  ) {}

  static create(props: PriceHistoryProps): PriceHistory {
    return new PriceHistory(
      props.id,
      props.price,
      new Date(props.recordedAt),
      props.recordedBy,
      props.reason?.trim() || null
    );
  }
}
