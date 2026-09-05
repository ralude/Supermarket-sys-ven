import { DomainError } from '@supermarket/shared';

/**
 * Snapshot del receptor capturado en la venta. No es un agregado `Customer`:
 * ADR-0018 difiere el maestro reutilizable hasta que tenga consumidor y
 * política de datos. Corregir el dato en una venta futura no reescribe una
 * venta ya emitida porque cada venta conserva su propia copia.
 */
export type SaleRecipientSnapshot = {
  readonly country: string;
  readonly type: string;
  readonly value: string;
  readonly normalizedValue: string;
  readonly name: string | null;
  readonly address: string | null;
};

/**
 * `type` es opcional: cuando el operador no lo declara, se deriva del país.
 * La regla vive aquí y no en el renderer, que solo adapta entrada y salida.
 */
export type SaleRecipientInput = {
  readonly country: string;
  readonly type?: string | null;
  readonly value: string;
  readonly name?: string | null;
  readonly address?: string | null;
};

/**
 * Prefijos VE que Cullen v1 soporta. Una persona natural se captura con el
 * prefijo `V`; no se modela un tipo `CI` separado mientras el RIF cubra ambos
 * casos con la misma forma estructural.
 */
const VE_RIF_PATTERN = /^[VEJPGC][0-9]{9}$/;

/** Tipo admitido por país. Los validadores por país se agregan después. */
export const saleRecipientTypeFor = (country: string): string =>
  (country === 'VE' ? 'RIF' : 'TAX_ID');

const optionalText = (value: string | null | undefined): string | null => {
  if (value === undefined || value === null) return null;
  const normalized = value.trim();
  return normalized.length === 0 ? null : normalized;
};

/**
 * Canonicaliza la identificación del receptor de forma determinista, con la
 * misma regla estructural aprobada para la identidad fiscal del proveedor:
 * para VE se eliminan los separadores admitidos y se exige un prefijo
 * soportado seguido de nueve dígitos. **No** aplica checksum, porque el
 * proyecto no tiene una fuente oficial verificable que defina el algoritmo.
 * Fuera de Venezuela la identidad es genérica `TAX_ID` y solo se normalizan
 * mayúsculas y espacios.
 */
export const createSaleRecipientSnapshot = (
  input: SaleRecipientInput
): SaleRecipientSnapshot => {
  const country = input.country.trim().toUpperCase();
  const value = input.value.trim();
  if (!/^[A-Z]{2}$/.test(country)) {
    throw new DomainError(
      'SALE_RECIPIENT_COUNTRY_INVALID',
      'Sale recipient country must be an ISO 3166-1 alpha-2 code.'
    );
  }
  const type = (input.type ?? saleRecipientTypeFor(country)).trim().toUpperCase();
  if (type !== saleRecipientTypeFor(country)) {
    throw new DomainError(
      'SALE_RECIPIENT_TYPE_INVALID',
      'Sale recipient identification type is not supported for this country.'
    );
  }
  if (value.length === 0) {
    throw new DomainError(
      'SALE_RECIPIENT_IDENTIFICATION_REQUIRED',
      'Sale recipient identification value is required.'
    );
  }
  const canonical = value.normalize('NFKC').toUpperCase();
  const name = optionalText(input.name);
  const address = optionalText(input.address);
  if (country !== 'VE') {
    return {
      country, type, value, normalizedValue: canonical.replace(/\s+/g, ''), name, address
    };
  }
  const normalizedValue = canonical.replace(/[\s.-]/g, '');
  if (!VE_RIF_PATTERN.test(normalizedValue)) {
    throw new DomainError(
      'SALE_RECIPIENT_IDENTIFICATION_INVALID',
      'Venezuelan recipient identification format is invalid.'
    );
  }
  return { country, type, value, normalizedValue, name, address };
};

export const cloneSaleRecipientSnapshot = (
  snapshot: SaleRecipientSnapshot
): SaleRecipientSnapshot => ({ ...snapshot });
