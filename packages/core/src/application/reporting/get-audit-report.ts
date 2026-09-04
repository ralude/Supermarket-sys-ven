import { ApplicationError, err, ok, type AppError, type Result } from '@supermarket/shared';
import type { ExecutionContext } from '../execution-context.js';
import type { AuditReportRepository, AuthorizationService } from '../ports/index.js';
import type { AuditReportEntryDto, AuditReportInput } from './dtos.js';
import { REPORT_PERMISSIONS } from './permissions.js';
import { resolveRowLimit } from './row-limit.js';

export class GetAuditReport {
  constructor(
    private readonly repository: AuditReportRepository,
    private readonly authorization: AuthorizationService
  ) {}

  async execute(
    input: AuditReportInput,
    context: ExecutionContext
  ): Promise<Result<readonly AuditReportEntryDto[], AppError>> {
    if (!await this.authorization.authorize(context, REPORT_PERMISSIONS.READ_AUDIT)) {
      return err(new ApplicationError('FORBIDDEN', 'Actor is not authorized to read audit reports.'));
    }
    return ok(await this.repository.findAuditEntries({ ...input, limit: resolveRowLimit(input.limit) }));
  }
}
