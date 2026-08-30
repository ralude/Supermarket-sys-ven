import {
  ApplicationError,
  DomainError,
  err,
  Money,
  ok,
  type AppError,
  type Result
} from '@supermarket/shared';
import type { CloseShiftProps } from '../../domain/cash/index.js';
import type { ExecutionContext } from '../execution-context.js';
import { persistBusinessChange } from '../events/index.js';
import type {
  AuditWriter,
  AuthorizationService,
  BusinessEventStore,
  Clock,
  IdGenerator,
  OutboxStore,
  PaymentMethodRepository,
  ShiftRepository,
  UnitOfWork
} from '../ports/index.js';
import type { CloseShiftInput, ShiftDto } from './dtos.js';
import { toShiftDto } from './mappers.js';
import { resolvePaymentMethod } from './payment-method-validation.js';
import { CASH_PERMISSIONS } from './permissions.js';

export class CloseShift {
  constructor(
    private readonly shiftRepository: ShiftRepository,
    private readonly paymentMethodRepository: PaymentMethodRepository,
    private readonly authorization: AuthorizationService,
    private readonly eventIdGenerator: IdGenerator,
    private readonly clock: Clock,
    private readonly unitOfWork: UnitOfWork,
    private readonly eventStore: BusinessEventStore,
    private readonly outboxStore: OutboxStore,
    private readonly auditWriter: AuditWriter,
    private readonly auditIdGenerator: IdGenerator
  ) {}

  async execute(input: CloseShiftInput, context: ExecutionContext): Promise<Result<ShiftDto, AppError>> {
    if (!(await this.authorization.authorize(context, CASH_PERMISSIONS.CLOSE_SHIFT))) {
      return err(new ApplicationError('FORBIDDEN', 'Actor is not authorized to close shifts.'));
    }
    try {
      return await this.unitOfWork.execute(async () => {
        const shift = await this.shiftRepository.findById(input.shiftId);
        if (shift === null) return err(new ApplicationError('SHIFT_NOT_FOUND', 'Shift was not found.'));
        const declaredBalances: CloseShiftProps['declaredBalances'] = [];
        for (const balance of input.declaredBalances) {
          const methodResult = await resolvePaymentMethod(
            this.paymentMethodRepository,
            balance.paymentMethodCode,
            balance.currencyCode
          );
          if (!methodResult.ok) return methodResult;
          declaredBalances.push({
            method: methodResult.value,
            amount: Money.fromMinorUnits(balance.amountMinorUnits, balance.currencyCode)
          });
        }
        const declared = new Map(declaredBalances.map((balance) => [
          `${balance.method.code}:${balance.amount.currency}`,
          balance.amount.minorUnits
        ]));
        const expected = new Map(shift.expectedBalances.map((balance) => [
          `${balance.paymentMethodCode}:${balance.amount.currency}`,
          balance.amount.minorUnits
        ]));
        const hasDifference = [...new Set([...declared.keys(), ...expected.keys()])]
          .some((key) => (declared.get(key) ?? 0) !== (expected.get(key) ?? 0));
        if (hasDifference && !(await this.authorization.authorize(
          context,
          CASH_PERMISSIONS.CLOSE_SHIFT_WITH_DIFFERENCE
        ))) {
          return err(new ApplicationError(
            'FORBIDDEN',
            'Actor is not authorized to close a shift with differences.'
          ));
        }
        const previousEventCount = shift.domainEvents.length;
        const closedAt = this.clock.now();
        shift.close({
          declaredBalances,
          closedBy: context.actorId,
          terminalId: context.terminalId,
          originNodeId: context.originNodeId,
          closedAt,
          eventId: this.eventIdGenerator.generate()
        });
        await persistBusinessChange(
          () => this.shiftRepository.save(shift),
          shift.domainEvents.slice(previousEventCount),
          context,
          undefined,
          this.eventStore,
          this.outboxStore,
          ['ShiftClosed'],
          this.auditWriter,
          [{
            auditId: this.auditIdGenerator.generate(),
            actorId: context.actorId,
            actorRoleCodes: context.actorRoleCodes ?? [],
            action: 'SHIFT_CLOSED',
            entityType: 'Shift',
            entityId: shift.id,
            before: { status: 'OPEN' },
            after: {
              status: shift.status,
              balances: shift.closingBalances?.map((balance) => ({
                paymentMethodCode: balance.paymentMethodCode,
                currencyCode: balance.expected.currency,
                expectedMinorUnits: balance.expected.minorUnits,
                declaredMinorUnits: balance.declared.minorUnits,
                differenceMinorUnits: balance.difference.minorUnits
              })) ?? []
            },
            reason: 'Shift closed with declared balances.',
            terminalId: context.terminalId,
            originNodeId: context.originNodeId,
            occurredAt: closedAt,
            correlationId: context.correlationId
          }]
        );
        return ok(toShiftDto(shift));
      });
    } catch (error) {
      if (error instanceof DomainError) return err(error);
      throw error;
    }
  }
}
