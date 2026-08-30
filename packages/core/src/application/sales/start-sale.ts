import {
  ApplicationError,
  DomainError,
  err,
  ok,
  type AppError,
  type Result
} from '@supermarket/shared';
import { Sale } from '../../domain/sales/index.js';
import type { ExecutionContext } from '../execution-context.js';
import type {
  BusinessEventStore,
  Clock,
  IdGenerator,
  SaleRepository,
  ShiftRepository,
  UnitOfWork
} from '../ports/index.js';
import { persistBusinessChange } from '../events/index.js';
import type { SaleDto, StartSaleInput } from './dtos.js';
import { toSaleDto } from './mappers.js';

export class StartSale {
  constructor(
    private readonly saleIdGenerator: IdGenerator,
    private readonly eventIdGenerator: IdGenerator,
    private readonly repository: SaleRepository,
    private readonly clock: Clock,
    private readonly shiftRepository: ShiftRepository,
    private readonly unitOfWork?: UnitOfWork,
    private readonly eventStore?: BusinessEventStore
  ) {}

  async execute(input: StartSaleInput, context: ExecutionContext): Promise<Result<SaleDto, AppError>> {
    try {
      const execute = async (): Promise<Result<SaleDto, AppError>> => {
        const shift = await this.shiftRepository.findById(input.shiftId);
        if (shift === null) return err(new ApplicationError('SHIFT_NOT_FOUND', 'Shift was not found.'));
        if (shift.status !== 'OPEN') {
          return err(new ApplicationError('SHIFT_INVALID_STATE', 'Sale requires an open shift.'));
        }
        if (shift.terminalId !== context.terminalId || shift.originNodeId !== context.originNodeId) {
          return err(new ApplicationError(
            'SHIFT_OWNERSHIP_MISMATCH',
            'Shift belongs to another terminal or node.'
          ));
        }
        const sale = Sale.start({
          id: this.saleIdGenerator.generate(),
          shiftId: shift.id,
          eventId: this.eventIdGenerator.generate(),
          currencyCode: input.currencyCode,
          terminalId: context.terminalId,
          originNodeId: context.originNodeId,
          startedBy: context.actorId,
          startedAt: this.clock.now()
        });
        await persistBusinessChange(
          () => this.repository.save(sale), sale.domainEvents, context,
          undefined, this.eventStore
        );
        return ok(toSaleDto(sale));
      };
      return this.unitOfWork ? await this.unitOfWork.execute(execute) : await execute();
    } catch (error) {
      if (error instanceof DomainError) return err(error);
      throw error;
    }
  }
}
