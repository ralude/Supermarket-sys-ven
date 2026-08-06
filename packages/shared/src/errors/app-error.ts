export type ErrorDetails = Record<string, unknown>;

export type AppErrorOptions = {
  details?: ErrorDetails;
  cause?: unknown;
};

export class AppError extends Error {
  readonly code: string;
  readonly details: ErrorDetails | undefined;

  constructor(code: string, message: string, options: AppErrorOptions = {}) {
    super(message, { cause: options.cause });
    this.name = 'AppError';
    this.code = code;
    this.details = options.details;
  }
}

export class DomainError extends AppError {
  constructor(code: string, message: string, options?: AppErrorOptions) {
    super(code, message, options);
    this.name = 'DomainError';
  }
}

export class ApplicationError extends AppError {
  constructor(code: string, message: string, options?: AppErrorOptions) {
    super(code, message, options);
    this.name = 'ApplicationError';
  }
}

export class InfrastructureError extends AppError {
  constructor(code: string, message: string, options?: AppErrorOptions) {
    super(code, message, options);
    this.name = 'InfrastructureError';
  }
}
