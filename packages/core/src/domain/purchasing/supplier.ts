import { DomainError } from '@supermarket/shared';

export type SupplierStatus = 'ACTIVE' | 'BLOCKED' | 'INACTIVE';

export type TaxIdentity = {
  readonly country: string;
  readonly type: string;
  readonly value: string;
  readonly normalizedValue: string;
};

export type SupplierProps = {
  id: string;
  code: string;
  legalName: string;
  tradeName?: string | null;
  fiscalAddress?: string | null;
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
  fiscalAddress?: string | null;
};

const optionalText = (value: string | null | undefined): string | null => {
  if (value === undefined || value === null) return null;
  const normalized = value.trim();
  return normalized.length === 0 ? null : normalized;
};

const supplierStatuses = new Set<SupplierStatus>(['ACTIVE', 'BLOCKED', 'INACTIVE']);

const validStatus = (status: SupplierStatus): SupplierStatus => {
  if (!supplierStatuses.has(status)) {
    throw new DomainError('SUPPLIER_STATUS_INVALID', 'Supplier status is invalid.');
  }
  return status;
};

export const createTaxIdentity = (
  input: Omit<TaxIdentity, 'normalizedValue'>
): TaxIdentity => {
  const country = input.country.trim().toUpperCase();
  const type = input.type.trim().toUpperCase();
  const value = input.value.trim();
  if (!/^[A-Z]{2}$/.test(country)) {
    throw new DomainError('SUPPLIER_TAX_COUNTRY_INVALID', 'Tax identity country is invalid.');
  }
  if (!/^[A-Z0-9_]{1,32}$/.test(type)) {
    throw new DomainError('SUPPLIER_TAX_TYPE_INVALID', 'Tax identity type is invalid.');
  }
  if (value.length === 0) {
    throw new DomainError('SUPPLIER_TAX_IDENTITY_REQUIRED', 'Tax identity value is required.');
  }
  const canonical = value.normalize('NFKC').toUpperCase();
  const normalizedValue = country === 'VE' && type === 'RIF'
    ? canonical.replace(/[\s-]/g, '')
    : canonical.trim();
  if (country === 'VE' && type === 'RIF' && !/^[VEJPGC][0-9]{9}$/.test(normalizedValue)) {
    throw new DomainError('SUPPLIER_TAX_IDENTITY_INVALID', 'Venezuelan RIF format is invalid.');
  }
  return { country, type, value, normalizedValue };
};

export class Supplier {
  private currentLegalName: string;
  private currentTradeName: string | null;
  private currentFiscalAddress: string | null;
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
      fiscalAddress: string | null;
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
      fiscalAddress: optionalText(props.fiscalAddress),
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
  get fiscalAddress(): string | null { return this.currentFiscalAddress; }
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
      this.currentFiscalAddress = optionalText(changes.fiscalAddress);
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
