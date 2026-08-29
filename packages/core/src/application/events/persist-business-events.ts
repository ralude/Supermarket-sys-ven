import type { ExecutionContext } from '../execution-context.js';
import type {
  AuditEntry,
  AuditWriter,
  BusinessEventStore,
  OutboxStore,
  UnitOfWork
} from '../ports/index.js';
import type { DomainEventLike } from './business-event.js';
import { toBusinessEvents } from './business-event.js';

export const persistBusinessChange = async (
  save: () => Promise<void>,
  events: readonly DomainEventLike[],
  context: ExecutionContext,
  unitOfWork?: UnitOfWork,
  eventStore?: BusinessEventStore,
  outboxStore?: OutboxStore,
  integrationEventTypes: readonly string[] = [],
  auditWriter?: AuditWriter,
  auditEntries: readonly AuditEntry[] = []
): Promise<void> => {
  const persist = async (): Promise<void> => {
    await save();
    const businessEvents = toBusinessEvents(events, context);
    if (eventStore) await eventStore.append(businessEvents);
    if (outboxStore) {
      await outboxStore.enqueue(businessEvents.filter((event) =>
        integrationEventTypes.includes(event.eventType)
      ));
    }
    if (auditWriter) await auditWriter.append(auditEntries);
  };
  if (unitOfWork) await unitOfWork.execute(persist);
  else await persist();
};
