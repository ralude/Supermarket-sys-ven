import type {
  AuditReportEntryDto,
  AuditReportInput,
  CashClosureReportEntryDto,
  CashClosureReportInput,
  FiscalOperationReportEntryDto,
  FiscalOperationsReportInput
} from '../reporting/dtos.js';
import type { ResolvedReportQuery } from '../reporting/row-limit.js';

export interface CashClosureReportRepository {
  findCashClosures(
    query: ResolvedReportQuery<CashClosureReportInput>
  ): Promise<readonly CashClosureReportEntryDto[]>;
}

export interface AuditReportRepository {
  findAuditEntries(
    query: ResolvedReportQuery<AuditReportInput>
  ): Promise<readonly AuditReportEntryDto[]>;
}

export interface FiscalOperationsReportRepository {
  findFiscalOperations(
    query: ResolvedReportQuery<FiscalOperationsReportInput>
  ): Promise<readonly FiscalOperationReportEntryDto[]>;
}
