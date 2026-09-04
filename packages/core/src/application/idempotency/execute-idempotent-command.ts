import {
  ApplicationError,
  err,
  type AppError,
  type Result
} from '@supermarket/shared';
import type { ExecutionContext } from '../execution-context.js';
import type { JsonValue } from '../events/index.js';
import type { IdempotencyStore, UnitOfWork } from '../ports/index.js';

const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export const executeIdempotentCommand = async <TInput, TOutput>(options: {
  readonly operation: string;
  readonly input: TInput;
  readonly context: ExecutionContext;
  readonly now: Date;
  readonly unitOfWork?: UnitOfWork;
  readonly idempotencyStore?: IdempotencyStore;
  readonly execute: () => Promise<Result<TOutput, AppError>>;
  readonly serialize: (output: TOutput) => JsonValue;
  readonly restore: (output: JsonValue) => TOutput;
}): Promise<Result<TOutput, AppError>> => {
  const key = options.context.idempotencyKey?.trim();
  if (options.idempotencyStore && !key) {
    return err(new ApplicationError(
      'IDEMPOTENCY_KEY_REQUIRED',
      'This command requires an idempotency key.'
    ));
  }
  const scope = `${options.context.originNodeId}:${options.operation}`;
  const fingerprint = JSON.stringify(options.input);
  const run = async (): Promise<Result<TOutput, AppError>> => {
    if (options.idempotencyStore && key) {
      const previous = await options.idempotencyStore.find(scope, key, options.now);
      if (previous) {
        if (previous.requestFingerprint !== fingerprint) {
          return err(new ApplicationError(
            'IDEMPOTENCY_KEY_CONFLICT',
            'Idempotency key was already used with another request.'
          ));
        }
        return { ok: true, value: options.restore(previous.result) };
      }
    }
    const result = await options.execute();
    if (result.ok && options.idempotencyStore && key) {
      await options.idempotencyStore.save({
        scope,
        key,
        requestFingerprint: fingerprint,
        status: 'COMPLETED',
        result: options.serialize(result.value),
        createdAt: options.now,
        expiresAt: new Date(options.now.getTime() + RETENTION_MS)
      });
    }
    return result;
  };
  return options.unitOfWork ? options.unitOfWork.execute(run) : run();
};
