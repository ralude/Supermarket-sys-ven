import {
  ApplicationError,
  DomainError,
  err,
  ok,
  Percentage,
  type AppError,
  type Result
} from '@supermarket/shared';
import type { ExecutionContext } from '../execution-context.js';
import type {
  AuthorizationService,
  Clock,
  DiscountPolicyProvider,
  IdGenerator,
  SaleRepository
} from '../ports/index.js';
import type { ApplyDiscountToSaleInput, SaleDto } from './dtos.js';
import { toSaleDto } from './mappers.js';
import { SALE_PERMISSIONS } from './permissions.js';

export class ApplyDiscountToSale {
  constructor(
    private readonly repository: SaleRepository,
    private readonly discountIdGenerator: IdGenerator,
    private readonly eventIdGenerator: IdGenerator,
    private readonly clock: Clock,
    private readonly policyProvider: DiscountPolicyProvider,
    private readonly authorization: AuthorizationService
  ) {}

  async execute(input: ApplyDiscountToSaleInput, context: ExecutionContext): Promise<Result<SaleDto, AppError>> {
    if (!(await this.authorization.authorize(context, SALE_PERMISSIONS.APPLY_DISCOUNT))) {
      return err(new ApplicationError('FORBIDDEN', 'Actor is not authorized to apply discounts.'));
    }
    try {
      const sale = await this.repository.findById(input.saleId);
      if (sale === null) return err(new ApplicationError('SALE_NOT_FOUND', 'Sale was not found.'));
      const policy = await this.policyProvider.getPolicy();
      sale.applyDiscount({
        id: this.discountIdGenerator.generate(),
        eventId: this.eventIdGenerator.generate(),
        lineItemId: input.itemId,
        percentage: Percentage.fromBasisPoints(input.basisPoints),
        reason: input.reason,
        appliedBy: context.actorId,
        occurredAt: this.clock.now(),
        maximumBasisPoints: policy.maximumBasisPoints
      });
      await this.repository.save(sale);
      return ok(toSaleDto(sale));
    } catch (error) {
      if (error instanceof DomainError) return err(error);
      throw error;
    }
  }
}
