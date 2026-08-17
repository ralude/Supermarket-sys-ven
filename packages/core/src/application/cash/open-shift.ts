import {
  ApplicationError,
  DomainError,
  err,
  Money,
  ok,
  type AppError,
  type Result
} from '@supermarket/shared';
import { Shift, type OpeningFund } from '../../domain/cash/index.js';
import type { ExecutionContext } from '../execution-context.js';
import type {
  AuthorizationService,
  CashRegisterRepository,
  Clock,
  IdGenerator,
  PaymentMethodRepository,
  ShiftRepository
} from '../ports/index.js';
import type { OpenShiftInput, ShiftDto } from './dtos.js';
import { toShiftDto } from './mappers.js';
import { resolveCashPaymentMethod } from './payment-method-validation.js';
import { CASH_PERMISSIONS } from './permissions.js';

export class OpenShift {
  constructor(
    private readonly cashRegisterRepository: CashRegisterRepository,
    private readonly shiftRepository: ShiftRepository,
    private readonly paymentMethodRepository: PaymentMethodRepository,
    private readonly authorization: AuthorizationService,
    private readonly shiftIdGenerator: IdGenerator,
    private readonly movementIdGenerator: IdGenerator,
    private readonly eventIdGenerator: IdGenerator,
    private readonly clock: Clock
  ) {}

  async execute(input: OpenShiftInput, context: ExecutionContext): Promise<Result<ShiftDto, AppError>> {
    if (!(await this.authorization.authorize(context, CASH_PERMISSIONS.OPEN_SHIFT))) {
      return err(new ApplicationError('FORBIDDEN', 'Actor is not authorized to open shifts.'));
    }
    try {
      const cashRegister = await this.cashRegisterRepository.findById(input.cashRegisterId);
      if (cashRegister === null) {
        return err(new ApplicationError('CASH_REGISTER_NOT_FOUND', 'Cash register was not found.'));
      }
      cashRegister.assertOperationalFor(context.terminalId, context.originNodeId);
      if (await this.shiftRepository.findOpenByCashRegisterId(cashRegister.id)) {
        return err(new ApplicationError('SHIFT_ALREADY_OPEN', 'Cash register already has an open shift.'));
      }

      const openingFunds: OpeningFund[] = [];
      for (const fund of input.openingFunds) {
        const methodResult = await resolveCashPaymentMethod(
          this.paymentMethodRepository,
          fund.paymentMethodCode,
          fund.currencyCode
        );
        if (!methodResult.ok) return methodResult;
        openingFunds.push({
          id: this.movementIdGenerator.generate(),
          method: methodResult.value,
          amount: Money.fromMinorUnits(fund.amountMinorUnits, fund.currencyCode)
        });
      }

      const shift = Shift.open({
        id: this.shiftIdGenerator.generate(),
        cashRegister,
        openingFunds,
        openedBy: context.actorId,
        openedAt: this.clock.now(),
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
