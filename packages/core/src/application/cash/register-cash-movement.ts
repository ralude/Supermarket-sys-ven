import {
  ApplicationError,
  DomainError,
  err,
  Money,
  ok,
  type AppError,
  type Result
} from '@supermarket/shared';
import type { ExecutionContext } from '../execution-context.js';
import { persistBusinessChange } from '../events/index.js';
import type {
  AuditWriter,
  AuthorizationService,
  BusinessEventStore,
  Clock,
  IdGenerator,
  IdempotencyStore,
  OutboxStore,
  PaymentMethodRepository,
  ShiftRepository,
  UnitOfWork
} from '../ports/index.js';
import type { RegisterCashMovementInput, ShiftDto } from './dtos.js';
import { toShiftDto } from './mappers.js';
import { resolveCashPaymentMethod } from './payment-method-validation.js';
import { CASH_PERMISSIONS } from './permissions.js';
import { executeIdempotentCommand } from '../idempotency/index.js';
import { restoreShiftDto, serializeShiftDto } from './shift-idempotency.js';

export class RegisterCashMovement {
  constructor(
    private readonly shiftRepository: ShiftRepository,
    private readonly paymentMethodRepository: PaymentMethodRepository,
    private readonly authorization: AuthorizationService,
    private readonly movementIdGenerator: IdGenerator,
    private readonly eventIdGenerator: IdGenerator,
    private readonly clock: Clock,
    private readonly unitOfWork: UnitOfWork,
    private readonly eventStore: BusinessEventStore,
    private readonly outboxStore: OutboxStore,
    private readonly auditWriter: AuditWriter,
    private readonly auditIdGenerator: IdGenerator,
    private readonly idempotencyStore?: IdempotencyStore
  ) {}

  async execute(
    input: RegisterCashMovementInput,
    context: ExecutionContext
  ): Promise<Result<ShiftDto, AppError>> {
    const permission = input.type === 'WITHDRAWAL'
      ? CASH_PERMISSIONS.REGISTER_WITHDRAWAL
      : CASH_PERMISSIONS.REGISTER_INCOME;
    if (!(await this.authorization.authorize(context, permission))) {
      return err(new ApplicationError('FORBIDDEN', 'Actor is not authorized for this cash movement.'));
    }
    try {
      const occurredAt = this.clock.now();
      return await executeIdempotentCommand({
        operation: 'RegisterCashMovement', input, context, now: occurredAt,
        unitOfWork: this.unitOfWork,
        ...(this.idempotencyStore ? { idempotencyStore: this.idempotencyStore } : {}),
        execute: async () => {
        const shift = await this.shiftRepository.findById(input.shiftId);
        if (shift === null) return err(new ApplicationError('SHIFT_NOT_FOUND', 'Shift was not found.'));
        const methodResult = await resolveCashPaymentMethod(
          this.paymentMethodRepository,
          input.paymentMethodCode,
          input.currencyCode
        );
        if (!methodResult.ok) return methodResult;
        const before = shift.expectedBalances.map((balance) => ({
          paymentMethodCode: balance.paymentMethodCode,
          currencyCode: balance.amount.currency,
          minorUnits: balance.amount.minorUnits
        }));
        const previousEventCount = shift.domainEvents.length;
        const movement = shift.registerMovement({
          id: this.movementIdGenerator.generate(),
          type: input.type,
          method: methodResult.value,
          amount: Money.fromMinorUnits(input.amountMinorUnits, input.currencyCode),
          reason: input.reason,
          registeredBy: context.actorId,
          terminalId: context.terminalId,
          originNodeId: context.originNodeId,
          occurredAt,
          eventId: this.eventIdGenerator.generate()
        });
        await persistBusinessChange(
          () => this.shiftRepository.save(shift),
          shift.domainEvents.slice(previousEventCount),
          context,
          undefined,
          this.eventStore,
          this.outboxStore,
          ['CashMovementRegistered'],
          this.auditWriter,
          [{
            auditId: this.auditIdGenerator.generate(),
            actorId: context.actorId,
            actorRoleCodes: context.actorRoleCodes ?? [],
            action: input.type === 'WITHDRAWAL'
              ? 'CASH_WITHDRAWAL_REGISTERED'
              : 'CASH_INCOME_REGISTERED',
            entityType: 'Shift',
            entityId: shift.id,
            before,
            after: {
              movementId: movement.id,
              paymentMethodCode: movement.method.code,
              currencyCode: movement.amount.currency,
              amountMinorUnits: movement.amount.minorUnits,
              balances: shift.expectedBalances.map((balance) => ({
                paymentMethodCode: balance.paymentMethodCode,
                currencyCode: balance.amount.currency,
                minorUnits: balance.amount.minorUnits
              }))
            },
            reason: movement.reason,
            terminalId: context.terminalId,
            originNodeId: context.originNodeId,
            occurredAt,
            correlationId: context.correlationId
          }]
        );
          return ok(toShiftDto(shift));
        },
        serialize: serializeShiftDto,
        restore: restoreShiftDto
      });
    } catch (error) {
      if (error instanceof DomainError) return err(error);
      throw error;
    }
  }
}
