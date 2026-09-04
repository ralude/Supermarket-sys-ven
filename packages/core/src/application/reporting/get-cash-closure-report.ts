import { ApplicationError, err, ok, type AppError, type Result } from '@supermarket/shared';
import type { ExecutionContext } from '../execution-context.js';
import type { AuthorizationService, CashClosureReportRepository } from '../ports/index.js';
import type { CashClosureReportInput, CashClosureReportEntryDto } from './dtos.js';
import { REPORT_PERMISSIONS } from './permissions.js';
import { resolveRowLimit } from './row-limit.js';

export class GetCashClosureReport {
  constructor(
    private readonly repository: CashClosureReportRepository,
    private readonly authorization: AuthorizationService
  ) {}

  async execute(
    input: CashClosureReportInput,
    context: ExecutionContext
  ): Promise<Result<readonly CashClosureReportEntryDto[], AppError>> {
    if (!await this.authorization.authorize(context, REPORT_PERMISSIONS.READ_CASH)) {
      return err(new ApplicationError('FORBIDDEN', 'Actor is not authorized to read cash reports.'));
    }
    return ok(await this.repository.findCashClosures({ ...input, limit: resolveRowLimit(input.limit) }));
  }
}
