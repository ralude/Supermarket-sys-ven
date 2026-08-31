import type { FiscalDocument } from '../../domain/fiscal/index.js';
import type { FiscalDocumentDto } from './dtos.js';

export const toFiscalDocumentDto = (document: FiscalDocument): FiscalDocumentDto => ({
  id: document.id,
  content: document.content,
  status: document.status,
  version: document.version,
  attempts: document.attempts,
  fiscalNumber: document.fiscalNumber,
  lastErrorCode: document.lastErrorCode,
  lastEvidence: document.lastEvidence
});
