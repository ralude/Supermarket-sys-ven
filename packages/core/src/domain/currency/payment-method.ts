import { DomainError } from '@supermarket/shared';

const PAYMENT_METHOD_CODE_PATTERN = /^[A-Z0-9_]+$/;
const CURRENCY_CODE_PATTERN = /^[A-Z]{3}$/;

export const PAYMENT_METHOD_KINDS = [
  'CASH',
  'CARD',
  'MOBILE_PAYMENT',
  'BANK_TRANSFER',
  'OTHER'
] as const;

export type PaymentMethodKind = (typeof PAYMENT_METHOD_KINDS)[number];

export type PaymentMethodProps = {
  code: string;
  name: string;
  kind: PaymentMethodKind;
  currencyCode: string;
  isActive?: boolean;
};

/**
 * Método de pago aceptado por el sistema (efectivo, tarjeta, pago móvil,
 * transferencia). Se vincula a una moneda de liquidación.
 */
export class PaymentMethod {
  private constructor(
    readonly code: string,
    readonly name: string,
    readonly kind: PaymentMethodKind,
    readonly currencyCode: string,
    readonly isActive: boolean
  ) {}

  static create(props: PaymentMethodProps): PaymentMethod {
    if (!PAYMENT_METHOD_CODE_PATTERN.test(props.code)) {
      throw new DomainError(
        'PAYMENT_METHOD_INVALID_CODE',
        'Payment method code must be uppercase letters, numbers or underscores.'
      );
    }

    const trimmedName = props.name.trim();
    if (trimmedName.length === 0) {
      throw new DomainError(
        'PAYMENT_METHOD_NAME_REQUIRED',
        'Payment method name is required.'
      );
    }

    if (!PAYMENT_METHOD_KINDS.includes(props.kind)) {
      throw new DomainError(
        'PAYMENT_METHOD_INVALID_KIND',
        'Payment method kind must be CASH, CARD, MOBILE_PAYMENT, BANK_TRANSFER or OTHER.'
      );
    }

    if (!CURRENCY_CODE_PATTERN.test(props.currencyCode)) {
      throw new DomainError(
        'PAYMENT_METHOD_INVALID_CURRENCY',
        'Currency code must be an uppercase three-letter code.'
      );
    }

    return new PaymentMethod(
      props.code,
      trimmedName,
      props.kind,
      props.currencyCode,
      props.isActive ?? true
    );
  }
}
