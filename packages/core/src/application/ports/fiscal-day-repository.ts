import type { FiscalDay } from '../../domain/fiscal/index.js';

export interface FiscalDayRepository {
  save(day: FiscalDay): Promise<void>;
  findById(id: string): Promise<FiscalDay | null>;
  findOpenByTerminal(terminalId: string): Promise<FiscalDay | null>;
  findByReportIdempotencyKey(originNodeId: string, key: string): Promise<FiscalDay | null>;
}
