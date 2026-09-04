import { ApplicationError, err, ok, type AppError, type Result } from '@supermarket/shared';
import type { ExecutionContext } from '../execution-context.js';
import type { FiscalDocumentRepository } from '../ports/index.js';
import type { FiscalDocumentDto } from './dtos.js';
import { toFiscalDocumentDto } from './mappers.js';

export class GetFiscalDocument {
  constructor(private readonly repository: FiscalDocumentRepository) {}

  async execute(id: string, context: ExecutionContext): Promise<Result<FiscalDocumentDto, AppError>> {
    const document = await this.repository.findById(id);
    if (!document || document.terminalId !== context.terminalId ||
      document.originNodeId !== context.originNodeId) {
      return err(new ApplicationError('FISCAL_DOCUMENT_NOT_FOUND', 'Fiscal document was not found.'));
    }
    return ok(toFiscalDocumentDto(document));
  }
}
