export const REPORT_ROW_LIMIT = { default: 100, maximum: 500 } as const;

export type ResolvedReportQuery<TInput> = Omit<TInput, 'limit'> & { readonly limit: number };

export const resolveRowLimit = (limit?: number): number => {
  if (limit === undefined || !Number.isInteger(limit) || limit < 1) return REPORT_ROW_LIMIT.default;
  return Math.min(limit, REPORT_ROW_LIMIT.maximum);
};
