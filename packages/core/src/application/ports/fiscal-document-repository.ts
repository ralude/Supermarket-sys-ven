import type { FiscalDocument, FiscalDocumentType } from '../../domain/fiscal/index.js';

export interface FiscalDocumentRepository {
  save(document: FiscalDocument): Promise<void>;
  findById(id: string): Promise<FiscalDocument | null>;
  /**
   * Localiza el documento que un nodo emitió para una referencia comercial.
   * La unicidad `(origin_node_id, document_type, reference_id)` garantiza que
   * una venta tenga a lo sumo una factura y una nota de crédito.
   */
  findByReference(
    originNodeId: string,
    type: FiscalDocumentType,
    referenceId: string
  ): Promise<FiscalDocument | null>;
  findByIdempotencyKey(originNodeId: string, key: string): Promise<FiscalDocument | null>;
  findActive(): Promise<FiscalDocument | null>;
  findRecoverable(): Promise<FiscalDocument[]>;
}
