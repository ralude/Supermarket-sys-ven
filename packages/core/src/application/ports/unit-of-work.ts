export interface UnitOfWork {
  execute<T>(work: () => Promise<T>): Promise<T>;
}
