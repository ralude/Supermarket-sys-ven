import { DomainError } from '@supermarket/shared';

export type SupplierStatus = 'ACTIVE' | 'BLOCKED' | 'INACTIVE';

export type TaxIdentity = {
  readonly country: string;
  readonly type: string;
  readonly value: string;
  readonly normalizedValue: string;
};

/**
 * Representación mínima evaluable por dominio y aplicación. Estado, municipio,
 * ciudad y código postal se agregarán cuando exista una regla que los exija.
 */
export type FiscalAddress = {
  readonly countryCode: string;
  readonly addressLine: string;
};

export type SupplierProps = {
  id: string;
  code: string;
  legalName: string;
  tradeName?: string | null;
  fiscalAddress?: FiscalAddress | null;
  taxIdentity: Omit<TaxIdentity, 'normalizedValue'>;
  status?: SupplierStatus;
  createdAt: Date;
};

export type RestoredSupplierProps = Omit<SupplierProps, 'taxIdentity' | 'createdAt'> & {
  taxIdentity: TaxIdentity;
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

export type SupplierChanges = {
  legalName?: string;
  tradeName?: string | null;
  fiscalAddress?: FiscalAddress | null;
};

const optionalText = (value: string | null | undefined): string | null => {
  if (value === undefined || value === null) return null;
  const normalized = value.trim();
  return normalized.length === 0 ? null : normalized;
};

const optionalAddress = (
  value: FiscalAddress | null | undefined
): FiscalAddress | null => (value === undefined || value === null
  ? null
  : createFiscalAddress(value));

const supplierStatuses = new Set<SupplierStatus>(['ACTIVE', 'BLOCKED', 'INACTIVE']);

const validStatus = (status: SupplierStatus): SupplierStatus => {
  if (!supplierStatuses.has(status)) {
    throw new DomainError('SUPPLIER_STATUS_INVALID', 'Supplier status is invalid.');
  }
  return status;
};

/**
 * Prefijos VE/RIF que Cullen v1 soporta explícitamente. La lista es del
 * producto, no una transcripción de una norma: ampliarla exige una fuente
 * oficial verificable.
 */
const VE_RIF_PREFIXES = 'VEJPGC';
const VE_RIF_PATTERN = new RegExp(`^[${VE_RIF_PREFIXES}][0-9]{9}$`);

/** Tipo fiscal admitido por país. Los validadores por país se agregan después. */
export const taxIdentityTypeFor = (country: string): string =>
  (country === 'VE' ? 'RIF' : 'TAX_ID');

/**
 * Canonicaliza la identidad fiscal de forma determinista. Para VE/RIF elimina
 * los separadores admitidos y exige una letra soportada seguida de nueve
 * dígitos; **no** aplica checksum, porque el proyecto todavía no tiene una
 * fuente oficial verificable del SENIAT que defina el algoritmo y no se
 * incorporan algoritmos comunitarios como requisito normativo. Para el resto de
 * los países la identidad es genérica `TAX_ID`: solo se normalizan mayúsculas y
 * espacios, sin reglas ni checksum específicos.
 */
export const createTaxIdentity = (
  input: Omit<TaxIdentity, 'normalizedValue'>
): TaxIdentity => {
  const country = input.country.trim().toUpperCase();
  const type = input.type.trim().toUpperCase();
  const value = input.value.trim();
  if (!/^[A-Z]{2}$/.test(country)) {
    throw new DomainError('SUPPLIER_TAX_COUNTRY_INVALID', 'Tax identity country is invalid.');
  }
  if (type !== taxIdentityTypeFor(country)) {
    throw new DomainError('SUPPLIER_TAX_TYPE_INVALID', 'Tax identity type is not supported for this country.');
  }
  if (value.length === 0) {
    throw new DomainError('SUPPLIER_TAX_IDENTITY_REQUIRED', 'Tax identity value is required.');
  }
  const canonical = value.normalize('NFKC').toUpperCase();
  if (country !== 'VE') {
    return { country, type, value, normalizedValue: canonical.replace(/\s+/g, '') };
  }
  const normalizedValue = canonical.replace(/[\s.-]/g, '');
  if (!VE_RIF_PATTERN.test(normalizedValue)) {
    throw new DomainError('SUPPLIER_TAX_IDENTITY_INVALID', 'Venezuelan RIF format is invalid.');
  }
  return { country, type, value, normalizedValue };
};

/**
 * La dirección fiscal es opcional en el maestro. Cuando existe, país y línea
 * son obligatorios: la regla que la exige antes de completar una recepción
 * venezolana debe poder evaluarse en aplicación, no en la interfaz.
 */
export const createFiscalAddress = (input: FiscalAddress): FiscalAddress => {
  const countryCode = input.countryCode.trim().toUpperCase();
  const addressLine = input.addressLine.trim();
  if (!/^[A-Z]{2}$/.test(countryCode)) {
    throw new DomainError(
      'SUPPLIER_FISCAL_ADDRESS_COUNTRY_INVALID',
      'Fiscal address country must be an ISO 3166-1 alpha-2 code.'
    );
  }
  if (addressLine.length === 0) {
    throw new DomainError(
      'SUPPLIER_FISCAL_ADDRESS_LINE_REQUIRED',
      'Fiscal address line is required.'
    );
  }
  return { countryCode, addressLine };
};

export class Supplier {
  private currentLegalName: string;
  private currentTradeName: string | null;
  private currentFiscalAddress: FiscalAddress | null;
  private currentTaxIdentity: TaxIdentity;
  private currentStatus: SupplierStatus;
  private currentUpdatedAt: Date;
  private currentVersion: number;

  private constructor(
    readonly id: string,
    readonly code: string,
    props: {
      legalName: string;
      tradeName: string | null;
      fiscalAddress: FiscalAddress | null;
      taxIdentity: TaxIdentity;
      status: SupplierStatus;
      createdAt: Date;
      updatedAt: Date;
      version: number;
    }
  ) {
    this.currentLegalName = props.legalName;
    this.currentTradeName = props.tradeName;
    this.currentFiscalAddress = props.fiscalAddress;
    this.currentTaxIdentity = props.taxIdentity;
    this.currentStatus = props.status;
    this.createdAt = new Date(props.createdAt);
    this.currentUpdatedAt = new Date(props.updatedAt);
    this.currentVersion = props.version;
  }

  readonly createdAt: Date;

  static create(props: SupplierProps): Supplier {
    const code = props.code.trim().toUpperCase();
    if (!/^SUP-[0-9]{6}$/.test(code)) {
      throw new DomainError('SUPPLIER_CODE_INVALID', 'Supplier code is invalid.');
    }
    const legalName = props.legalName.trim();
    if (legalName.length === 0) {
      throw new DomainError('SUPPLIER_LEGAL_NAME_REQUIRED', 'Supplier legal name is required.');
    }
    return new Supplier(props.id, code, {
      legalName,
      tradeName: optionalText(props.tradeName),
      fiscalAddress: optionalAddress(props.fiscalAddress),
      taxIdentity: createTaxIdentity(props.taxIdentity),
      status: validStatus(props.status ?? 'ACTIVE'),
      createdAt: props.createdAt,
      updatedAt: props.createdAt,
      version: 1
    });
  }

  static restore(props: RestoredSupplierProps): Supplier {
    const supplier = Supplier.create(props);
    if (supplier.currentTaxIdentity.normalizedValue !== props.taxIdentity.normalizedValue) {
      throw new DomainError('SUPPLIER_TAX_IDENTITY_INVALID', 'Stored tax identity is inconsistent.');
    }
    supplier.currentUpdatedAt = new Date(props.updatedAt);
    supplier.currentVersion = props.version;
    return supplier;
  }

  get legalName(): string { return this.currentLegalName; }
  get tradeName(): string | null { return this.currentTradeName; }
  get fiscalAddress(): FiscalAddress | null {
    return this.currentFiscalAddress ? { ...this.currentFiscalAddress } : null;
  }
  get taxIdentity(): TaxIdentity { return { ...this.currentTaxIdentity }; }
  get status(): SupplierStatus { return this.currentStatus; }
  get updatedAt(): Date { return new Date(this.currentUpdatedAt); }
  get version(): number { return this.currentVersion; }

  update(changes: SupplierChanges, occurredAt: Date): void {
    if (Object.keys(changes).length === 0) {
      throw new DomainError('SUPPLIER_UPDATE_REQUIRED', 'At least one supplier field must change.');
    }
    if (changes.legalName !== undefined) {
      const legalName = changes.legalName.trim();
      if (legalName.length === 0) {
        throw new DomainError('SUPPLIER_LEGAL_NAME_REQUIRED', 'Supplier legal name is required.');
      }
      this.currentLegalName = legalName;
    }
    if (changes.tradeName !== undefined) this.currentTradeName = optionalText(changes.tradeName);
    if (changes.fiscalAddress !== undefined) {
      this.currentFiscalAddress = optionalAddress(changes.fiscalAddress);
    }
    this.touch(occurredAt);
  }

  changeStatus(status: SupplierStatus, occurredAt: Date): void {
    this.currentStatus = validStatus(status);
    this.touch(occurredAt);
  }

  correctTaxIdentity(
    identity: Omit<TaxIdentity, 'normalizedValue'>,
    occurredAt: Date
  ): void {
    this.currentTaxIdentity = createTaxIdentity(identity);
    this.touch(occurredAt);
  }

  private touch(occurredAt: Date): void {
    this.currentUpdatedAt = new Date(occurredAt);
    this.currentVersion += 1;
  }
}
