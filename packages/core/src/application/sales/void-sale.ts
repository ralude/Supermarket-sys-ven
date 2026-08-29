import { ApplicationError, DomainError, err, ok, type AppError, type Result } from '@supermarket/shared';
import type { ExecutionContext } from '../execution-context.js';
import { persistBusinessChange } from '../events/index.js';
import type {
  AuthorizationService,
  AuditWriter,
  BusinessEventStore,
  Clock,
  IdGenerator,
  SaleRepository,
  UnitOfWork
} from '../ports/index.js';
import type { SaleDto, VoidSaleInput } from './dtos.js';
import { toSaleDto } from './mappers.js';
import { SALE_PERMISSIONS } from './permissions.js';

export class VoidSale {
  constructor(
    private readonly repository: SaleRepository,
    private readonly authorization: AuthorizationService,
    private readonly eventIdGenerator: IdGenerator,
    private readonly clock: Clock,
    private readonly unitOfWork?: UnitOfWork,
    private readonly eventStore?: BusinessEventStore,
    private readonly auditWriter?: AuditWriter
  ) {}

  async execute(input: VoidSaleInput, context: ExecutionContext): Promise<Result<SaleDto, AppError>> {
    if (!(await this.authorization.authorize(context, SALE_PERMISSIONS.VOID))) {
      return err(new ApplicationError('FORBIDDEN', 'Actor is not authorized to void sales.'));
    }
    try {
      const sale = await this.repository.findById(input.saleId);
      if (sale === null) return err(new ApplicationError('SALE_NOT_FOUND', 'Sale was not found.'));
      const previousStatus = sale.status;
      const voidedAt = this.clock.now();
      const eventId = this.eventIdGenerator.generate();
      sale.void({
        reason: input.reason,
        voidedBy: context.actorId,
        voidedAt,
        eventId
      });
      await persistBusinessChange(
        () => this.repository.save(sale), sale.domainEvents, context,
        this.unitOfWork, this.eventStore, undefined, [], this.auditWriter, [{
          auditId: eventId,
          actorId: context.actorId,
          actorRoleCodes: context.actorRoleCodes ?? [],
          action: 'SALE_VOIDED',
          entityType: 'Sale',
          entityId: sale.id,
          before: { status: previousStatus },
          after: { status: sale.status },
          reason: input.reason.trim(),
          terminalId: context.terminalId,
          originNodeId: context.originNodeId,
          occurredAt: voidedAt,
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
