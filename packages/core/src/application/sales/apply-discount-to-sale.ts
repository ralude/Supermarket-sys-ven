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
import { persistBusinessChange } from '../events/index.js';
import type {
  AuthorizationService,
  AuditWriter,
  Clock,
  DiscountPolicyProvider,
  IdGenerator,
  SaleRepository,
  BusinessEventStore,
  UnitOfWork
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
    private readonly authorization: AuthorizationService,
    private readonly unitOfWork?: UnitOfWork,
    private readonly eventStore?: BusinessEventStore,
    private readonly auditWriter?: AuditWriter
  ) {}

  async execute(input: ApplyDiscountToSaleInput, context: ExecutionContext): Promise<Result<SaleDto, AppError>> {
    if (!(await this.authorization.authorize(context, SALE_PERMISSIONS.APPLY_DISCOUNT))) {
      return err(new ApplicationError('FORBIDDEN', 'Actor is not authorized to apply discounts.'));
    }
    try {
      const sale = await this.repository.findById(input.saleId);
      if (sale === null) return err(new ApplicationError('SALE_NOT_FOUND', 'Sale was not found.'));
      const policy = await this.policyProvider.getPolicy();
      const occurredAt = this.clock.now();
      const beforeTotal = sale.total.minorUnits;
      const eventId = this.eventIdGenerator.generate();
      sale.applyDiscount({
        id: this.discountIdGenerator.generate(),
        eventId,
        lineItemId: input.itemId,
        percentage: Percentage.fromBasisPoints(input.basisPoints),
        reason: input.reason,
        appliedBy: context.actorId,
        occurredAt,
        maximumBasisPoints: policy.maximumBasisPoints
      });
      await persistBusinessChange(
        () => this.repository.save(sale), sale.domainEvents, context,
        this.unitOfWork, this.eventStore, undefined, [], this.auditWriter, [{
          auditId: eventId,
          actorId: context.actorId,
          actorRoleCodes: context.actorRoleCodes ?? [],
          action: 'SALE_DISCOUNT_OVERRIDE_APPLIED',
          entityType: 'Sale',
          entityId: sale.id,
          before: { totalMinorUnits: beforeTotal, currencyCode: sale.currencyCode },
          after: { totalMinorUnits: sale.total.minorUnits, currencyCode: sale.currencyCode },
          reason: input.reason.trim(),
          terminalId: context.terminalId,
          originNodeId: context.originNodeId,
          occurredAt,
          correlationId: context.correlationId
        }]
      );
      return ok(toSaleDto(sale));
    } catch (error) {
      if (error instanceof DomainError) return err(error);
      throw error;
    }
  }
}
