import type { FiscalDocument } from '../../domain/fiscal/index.js';

export interface FiscalDocumentRepository {
  save(document: FiscalDocument): Promise<void>;
  findById(id: string): Promise<FiscalDocument | null>;
  findByIdempotencyKey(originNodeId: string, key: string): Promise<FiscalDocument | null>;
  findActive(): Promise<FiscalDocument | null>;
  findRecoverable(): Promise<FiscalDocument[]>;
}
