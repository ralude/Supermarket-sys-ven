import type { Money, TaxRate } from '@supermarket/shared';

export type ProductSnapshotProps = {
  productId: string;
  description: string;
  price: Money;
  taxRate: TaxRate;
  unitCode: string;
  unitScale: number;
};

export class ProductSnapshot {
  private constructor(
    readonly productId: string,
    readonly description: string,
    readonly price: Money,
    readonly taxRate: TaxRate,
    readonly unitCode: string,
    readonly unitScale: number
  ) {}

  static create(props: ProductSnapshotProps): ProductSnapshot {
    return new ProductSnapshot(
      props.productId,
      props.description,
      props.price,
      props.taxRate,
      props.unitCode,
      props.unitScale
    );
  }
}
