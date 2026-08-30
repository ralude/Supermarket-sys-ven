import type {
  AuditWriter, AuthorizationService, BusinessEventStore, Clock, FiscalDayRepository,
  FiscalPrinterPort, IdGenerator, OutboxStore, UnitOfWork
} from '../ports/index.js';
import { PrintFiscalReport } from './print-fiscal-report.js';

export class PrintZReport extends PrintFiscalReport {
  constructor(
    repository: FiscalDayRepository,
    printer: FiscalPrinterPort,
    authorization: AuthorizationService,
    idGenerator: IdGenerator,
    eventIdGenerator: IdGenerator,
    auditIdGenerator: IdGenerator,
    clock: Clock,
    unitOfWork: UnitOfWork,
    eventStore: BusinessEventStore,
    outboxStore: OutboxStore,
    auditWriter: AuditWriter
  ) {
    super(
      'Z', repository, printer, authorization, idGenerator, eventIdGenerator,
      auditIdGenerator, clock, unitOfWork, eventStore, outboxStore, auditWriter
    );
  }
}
