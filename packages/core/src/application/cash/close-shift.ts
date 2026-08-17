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
import type {
  AuthorizationService,
  Clock,
  IdGenerator,
  PaymentMethodRepository,
  ShiftRepository
} from '../ports/index.js';
import type { CloseShiftInput, ShiftDto } from './dtos.js';
import { toShiftDto } from './mappers.js';
import { resolveCashPaymentMethod } from './payment-method-validation.js';
import { CASH_PERMISSIONS } from './permissions.js';

export class CloseShift {
  constructor(
    private readonly shiftRepository: ShiftRepository,
    private readonly paymentMethodRepository: PaymentMethodRepository,
    private readonly authorization: AuthorizationService,
    private readonly eventIdGenerator: IdGenerator,
    private readonly clock: Clock
  ) {}

  async execute(input: CloseShiftInput, context: ExecutionContext): Promise<Result<ShiftDto, AppError>> {
    if (!(await this.authorization.authorize(context, CASH_PERMISSIONS.CLOSE_SHIFT))) {
      return err(new ApplicationError('FORBIDDEN', 'Actor is not authorized to close shifts.'));
    }
    try {
      const shift = await this.shiftRepository.findById(input.shiftId);
      if (shift === null) return err(new ApplicationError('SHIFT_NOT_FOUND', 'Shift was not found.'));
      const declaredBalances: CloseShiftProps['declaredBalances'] = [];
      for (const balance of input.declaredBalances) {
        const methodResult = await resolveCashPaymentMethod(
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
      shift.close({
        declaredBalances,
        closedBy: context.actorId,
        terminalId: context.terminalId,
        originNodeId: context.originNodeId,
        closedAt: this.clock.now(),
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
