import { describe, expect, it, vi } from 'vitest';
import {
  withFiscalSimulatorGuard,
  withSimulatedFiscalReportGuard
} from './fiscal-simulator-guard.js';

describe('fiscal simulator contract guards', () => {
  it.each([undefined, null, 'HARDWARE', 'HIL'])(
    'refuses execution target %s before invoking a printer operation',
    (executionTarget) => {
      const printerOperation = vi.fn();

      expect(() => withFiscalSimulatorGuard(
        executionTarget,
        printerOperation
      )).toThrowError('FISCAL_CONTRACT_SIMULATOR_REQUIRED');
      expect(printerOperation).not.toHaveBeenCalled();
    }
  );

  it('refuses X/Z without explicit simulated-report consent before invoking the operation', () => {
    const printerOperation = vi.fn();

    expect(() => withSimulatedFiscalReportGuard(
      'SIMULATOR',
      undefined,
      printerOperation
    )).toThrowError('FISCAL_CONTRACT_SIMULATED_REPORT_CONSENT_REQUIRED');
    expect(printerOperation).not.toHaveBeenCalled();
  });

  it('refuses X/Z on a non-simulator target even when simulated consent is supplied', () => {
    const printerOperation = vi.fn();

    expect(() => withSimulatedFiscalReportGuard(
      'HARDWARE',
      'ALLOW_SIMULATED_X_AND_Z',
      printerOperation
    )).toThrowError('FISCAL_CONTRACT_SIMULATOR_REQUIRED');
    expect(printerOperation).not.toHaveBeenCalled();
  });

  it('allows an explicitly consented simulated report operation', () => {
    const printerOperation = vi.fn(() => 'executed');

    expect(withSimulatedFiscalReportGuard(
      'SIMULATOR',
      'ALLOW_SIMULATED_X_AND_Z',
      printerOperation
    )).toBe('executed');
    expect(printerOperation).toHaveBeenCalledOnce();
  });
});
