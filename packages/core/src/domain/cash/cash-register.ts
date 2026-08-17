import { DomainError } from '@supermarket/shared';

export type CashRegisterProps = {
  id: string;
  name: string;
  terminalId: string;
  originNodeId: string;
  isActive?: boolean;
};

export class CashRegister {
  private constructor(
    readonly id: string,
    readonly name: string,
    readonly terminalId: string,
    readonly originNodeId: string,
    readonly isActive: boolean
  ) {}

  static create(props: CashRegisterProps): CashRegister {
    const id = CashRegister.requireText(props.id, 'CASH_REGISTER_ID_REQUIRED', 'Cash register ID is required.');
    const name = CashRegister.requireText(props.name, 'CASH_REGISTER_NAME_REQUIRED', 'Cash register name is required.');
    const terminalId = CashRegister.requireText(
      props.terminalId,
      'CASH_REGISTER_TERMINAL_REQUIRED',
      'Cash register terminal is required.'
    );
    const originNodeId = CashRegister.requireText(
      props.originNodeId,
      'CASH_REGISTER_NODE_REQUIRED',
      'Cash register origin node is required.'
    );
    return new CashRegister(id, name, terminalId, originNodeId, props.isActive ?? true);
  }

  assertOperationalFor(terminalId: string, originNodeId: string): void {
    if (!this.isActive) {
      throw new DomainError('CASH_REGISTER_INACTIVE', 'Cash register is inactive.');
    }
    if (this.terminalId !== terminalId || this.originNodeId !== originNodeId) {
      throw new DomainError(
        'CASH_REGISTER_OWNERSHIP_MISMATCH',
        'Cash register belongs to another terminal or node.'
      );
    }
  }

  private static requireText(value: string, code: string, message: string): string {
    const normalized = value.trim();
    if (normalized.length === 0) throw new DomainError(code, message);
    return normalized;
  }
}
