import type { Clock, EventPublisher, OutboxStore, UnitOfWork } from '../ports/index.js';

export class OutboxRelay {
  constructor(
    private readonly store: OutboxStore,
    private readonly publisher: EventPublisher,
    private readonly unitOfWork: UnitOfWork,
    private readonly clock: Clock,
    private readonly leaseMilliseconds = 30_000
  ) {}

  async runBatch(limit = 20): Promise<number> {
    const claimedAt = this.clock.now();
    const events = await this.unitOfWork.execute(() => this.store.claimAvailable(
      claimedAt,
      new Date(claimedAt.getTime() + this.leaseMilliseconds),
      limit
    ));

    for (const event of events) {
      try {
        await this.publisher.publish(event);
        await this.unitOfWork.execute(() => this.store.markPublished(event.eventId, this.clock.now()));
      } catch {
        const nextAttemptAt = new Date(this.clock.now().getTime() + Math.min(
          60_000,
          1000 * 2 ** Math.min(event.attempts - 1, 6)
        ));
        await this.unitOfWork.execute(() => this.store.markFailed(
          event.eventId,
          nextAttemptAt,
          'EVENT_PUBLICATION_FAILED'
        ));
      }
    }
    return events.length;
  }
}
