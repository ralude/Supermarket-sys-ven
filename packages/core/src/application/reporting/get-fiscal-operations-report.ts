import { ApplicationError, err, ok, type AppError, type Result } from '@supermarket/shared';
import type { ExecutionContext } from '../execution-context.js';
import type { AuthorizationService, FiscalOperationsReportRepository } from '../ports/index.js';
import type { FiscalOperationReportEntryDto, FiscalOperationsReportInput } from './dtos.js';
import { REPORT_PERMISSIONS } from './permissions.js';
import { resolveRowLimit } from './row-limit.js';

export class GetFiscalOperationsReport {
  constructor(
    private readonly repository: FiscalOperationsReportRepository,
    private readonly authorization: AuthorizationService
  ) {}

  async execute(
    input: FiscalOperationsReportInput,
    context: ExecutionContext
  ): Promise<Result<readonly FiscalOperationReportEntryDto[], AppError>> {
    if (!await this.authorization.authorize(context, REPORT_PERMISSIONS.READ_FISCAL)) {
      return err(new ApplicationError('FORBIDDEN', 'Actor is not authorized to read fiscal reports.'));
    }
    return ok(await this.repository.findFiscalOperations({ ...input, limit: resolveRowLimit(input.limit) }));
  }
}
