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
import type {
  AuthorizationService,
  Clock,
  IdGenerator,
  PaymentMethodRepository,
  ShiftRepository
} from '../ports/index.js';
import type { RegisterCashMovementInput, ShiftDto } from './dtos.js';
import { toShiftDto } from './mappers.js';
import { resolveCashPaymentMethod } from './payment-method-validation.js';
import { CASH_PERMISSIONS } from './permissions.js';

export class RegisterCashMovement {
  constructor(
    private readonly shiftRepository: ShiftRepository,
    private readonly paymentMethodRepository: PaymentMethodRepository,
    private readonly authorization: AuthorizationService,
    private readonly movementIdGenerator: IdGenerator,
    private readonly eventIdGenerator: IdGenerator,
    private readonly clock: Clock
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
      const shift = await this.shiftRepository.findById(input.shiftId);
      if (shift === null) return err(new ApplicationError('SHIFT_NOT_FOUND', 'Shift was not found.'));
      const methodResult = await resolveCashPaymentMethod(
        this.paymentMethodRepository,
        input.paymentMethodCode,
        input.currencyCode
      );
      if (!methodResult.ok) return methodResult;
      shift.registerMovement({
        id: this.movementIdGenerator.generate(),
        type: input.type,
        method: methodResult.value,
        amount: Money.fromMinorUnits(input.amountMinorUnits, input.currencyCode),
        reason: input.reason,
        registeredBy: context.actorId,
        terminalId: context.terminalId,
        originNodeId: context.originNodeId,
        occurredAt: this.clock.now(),
        eventId: this.eventIdGenerator.generate()
      });
      await this.shiftRepository.save(shift);
      return ok(toShiftDto(shift));
    } catch (error) {
      if (error instanceof DomainError) return err(error);
      throw error;
    }
  }
}
