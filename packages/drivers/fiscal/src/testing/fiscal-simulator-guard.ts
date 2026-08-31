export const FISCAL_SIMULATOR_EXECUTION_TARGET = 'SIMULATOR' as const;
export const ALLOW_SIMULATED_X_AND_Z = 'ALLOW_SIMULATED_X_AND_Z' as const;

export function withFiscalSimulatorGuard<T>(
  executionTarget: unknown,
  execute: () => T
): T {
  if (executionTarget !== FISCAL_SIMULATOR_EXECUTION_TARGET) {
    throw new Error('FISCAL_CONTRACT_SIMULATOR_REQUIRED');
  }

  return execute();
}

export function withSimulatedFiscalReportGuard<T>(
  executionTarget: unknown,
  reportConsent: unknown,
  execute: () => T
): T {
  return withFiscalSimulatorGuard(executionTarget, () => {
    if (reportConsent !== ALLOW_SIMULATED_X_AND_Z) {
      throw new Error('FISCAL_CONTRACT_SIMULATED_REPORT_CONSENT_REQUIRED');
    }

    return execute();
  });
}
