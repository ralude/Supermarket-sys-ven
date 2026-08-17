export type DiscountPolicy = {
  id: string;
  maximumBasisPoints: number;
};

export interface DiscountPolicyProvider {
  getPolicy(): Promise<DiscountPolicy>;
}
