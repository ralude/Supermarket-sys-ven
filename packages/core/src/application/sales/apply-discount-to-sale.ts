import {
  ApplicationError,
  AppError,
  err,
  ok,
  Percentage,
  type Result
} from '@supermarket/shared';
import type { ExecutionContext } from '../execution-context.js';
import { persistBusinessChange } from '../events/index.js';
import type { JsonValue } from '../events/index.js';
import { executeIdempotentCommand } from '../idempotency/index.js';
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
import type { IdempotencyStore } from '../ports/index.js';
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
    private readonly auditWriter?: AuditWriter,
    private readonly idempotencyStore?: IdempotencyStore
  ) {}

  async execute(input: ApplyDiscountToSaleInput, context: ExecutionContext): Promise<Result<SaleDto, AppError>> {
    if (!(await this.authorization.authorize(context, SALE_PERMISSIONS.APPLY_DISCOUNT))) {
      return err(new ApplicationError('FORBIDDEN', 'Actor is not authorized to apply discounts.'));
    }
    try {
      return await executeIdempotentCommand({
        operation: 'ApplyDiscountToSale', input, context, now: this.clock.now(),
        ...(this.unitOfWork ? { unitOfWork: this.unitOfWork } : {}),
        ...(this.idempotencyStore ? { idempotencyStore: this.idempotencyStore } : {}),
        execute: async () => {
          const sale = await this.repository.findById(input.saleId);
          if (sale === null || sale.terminalId !== context.terminalId ||
            sale.originNodeId !== context.originNodeId) {
            return err(new ApplicationError('SALE_NOT_FOUND', 'Sale was not found.'));
          }
          const policy = await this.policyProvider.getPolicy();
          const occurredAt = this.clock.now();
          const beforeTotal = sale.total.minorUnits;
          const eventId = this.eventIdGenerator.generate();
          sale.applyDiscount({
            id: this.discountIdGenerator.generate(), eventId, lineItemId: input.itemId,
            percentage: Percentage.fromBasisPoints(input.basisPoints), reason: input.reason,
            appliedBy: context.actorId, occurredAt,
            maximumBasisPoints: policy.maximumBasisPoints
          });
          await persistBusinessChange(
            () => this.repository.save(sale), sale.domainEvents, context,
            undefined, this.eventStore, undefined, [], this.auditWriter, [{
              auditId: eventId, actorId: context.actorId,
              actorRoleCodes: context.actorRoleCodes ?? [],
              action: 'SALE_DISCOUNT_OVERRIDE_APPLIED', entityType: 'Sale', entityId: sale.id,
              before: { totalMinorUnits: beforeTotal, currencyCode: sale.currencyCode },
              after: { totalMinorUnits: sale.total.minorUnits, currencyCode: sale.currencyCode },
              reason: input.reason.trim(), terminalId: context.terminalId,
              originNodeId: context.originNodeId, occurredAt,
              correlationId: context.correlationId
            }]
          );
          return ok(toSaleDto(sale));
        },
        serialize: (output) => JSON.parse(JSON.stringify(output)) as JsonValue,
        restore: restoreSaleDto
      });
    } catch (error) {
      if (error instanceof AppError) return err(error);
      throw error;
    }
  }
}

const restoreSaleDto = (value: JsonValue): SaleDto => {
  const dto = value as unknown as SaleDto & { completedAt: string | null; voidedAt: string | null };
  return { ...dto, completedAt: dto.completedAt ? new Date(dto.completedAt) : null,
    voidedAt: dto.voidedAt ? new Date(dto.voidedAt) : null };
};
