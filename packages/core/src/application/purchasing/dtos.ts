import type { SupplierStatus } from '../../domain/purchasing/index.js';

export type SupplierDto = {
  id: string;
  code: string;
  legalName: string;
  tradeName: string | null;
  fiscalAddress: string | null;
  taxIdentity: {
    country: string;
    type: string;
    value: string;
    normalizedValue: string;
  };
  status: SupplierStatus;
  createdAt: string;
  updatedAt: string;
  version: number;
};

export type CreateSupplierInput = {
  legalName: string;
  tradeName?: string;
  fiscalAddress?: string;
  taxIdentity: { country?: string; type: string; value: string };
  reason: string;
};

export type UpdateSupplierInput = {
  supplierId: string;
  legalName?: string;
  tradeName?: string | null;
  fiscalAddress?: string | null;
  reason: string;
};

export type ChangeSupplierStatusInput = {
  supplierId: string;
  status: SupplierStatus;
  reason: string;
};

export type CorrectSupplierTaxIdentityInput = {
  supplierId: string;
  taxIdentity: { country?: string; type: string; value: string };
  reason: string;
};

