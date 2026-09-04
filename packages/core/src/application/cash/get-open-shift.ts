import { ApplicationError, err, ok, type AppError, type Result } from '@supermarket/shared';
import type { ExecutionContext } from '../execution-context.js';
import type { ShiftRepository } from '../ports/index.js';
import type { ShiftDto } from './dtos.js';
import { toShiftDto } from './mappers.js';

export class GetOpenShift {
  constructor(private readonly repository: ShiftRepository) {}

  async execute(
    cashRegisterId: string,
    context: ExecutionContext
  ): Promise<Result<ShiftDto, AppError>> {
    const shift = await this.repository.findOpenByCashRegisterId(cashRegisterId);
    if (shift === null || shift.terminalId !== context.terminalId ||
      shift.originNodeId !== context.originNodeId) {
      return err(new ApplicationError('SHIFT_NOT_FOUND', 'Open shift was not found.'));
    }
    return ok(toShiftDto(shift));
  }
}
