import { problemDetailsSchema, type HttpContractV1 } from './common.contracts.js';

export type CreateProductRequest = {
  readonly name: string;
  readonly description: string;
  readonly categoryId: string;
  readonly unitCode: string;
  readonly barcodes: readonly string[];
  readonly priceMinorUnits: number;
  readonly currencyCode: string;
  readonly taxRateBasisPoints: number;
  readonly reason: string;
};

export type UpdateProductRequest = {
  readonly name?: string;
  readonly description?: string;
  readonly categoryId?: string;
  readonly unitCode?: string;
  readonly barcodes?: readonly string[];
  readonly isActive?: boolean;
  readonly reason: string;
};

export type UpdatePriceRequest = {
  readonly priceMinorUnits: number;
  readonly currencyCode: string;
  readonly reason: string;
};

export type ProductResponse = {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly categoryId: string;
  readonly unitCode: string;
  readonly unitScale: number;
  readonly barcodes: readonly string[];
  readonly price: { readonly amountMinorUnits: number; readonly currencyCode: string };
  readonly taxRateBasisPoints: number;
  readonly isActive: boolean;
  readonly version: number;
  readonly snapshot: {
    readonly productId: string;
    readonly description: string;
    readonly priceMinorUnits: number;
    readonly currencyCode: string;
    readonly taxRateBasisPoints: number;
    readonly unitCode: string;
    readonly unitScale: number;
  };
};
export type PriceHistoryResponse = {
  readonly id: string; readonly priceMinorUnits: number; readonly currencyCode: string;
  readonly recordedAt: string; readonly recordedBy: string; readonly reason: string;
};

const idempotencyHeaders = {
  type: 'object', required: ['idempotency-key'],
  properties: { 'idempotency-key': { type: 'string', minLength: 1, maxLength: 128 } }
} as const;

const productResponseSchema = {
  type: 'object', additionalProperties: false,
  required: [
    'id', 'name', 'description', 'categoryId', 'unitCode', 'unitScale',
    'barcodes', 'price', 'taxRateBasisPoints', 'isActive', 'version', 'snapshot'
  ],
  properties: {
    id: { type: 'string' }, name: { type: 'string' }, description: { type: 'string' },
    categoryId: { type: 'string' }, unitCode: { type: 'string' },
    unitScale: { type: 'integer', minimum: 0 },
    barcodes: { type: 'array', items: { type: 'string' } },
    price: {
      type: 'object', additionalProperties: false,
      required: ['amountMinorUnits', 'currencyCode'],
      properties: {
        amountMinorUnits: { type: 'integer' }, currencyCode: { type: 'string' }
      }
    },
    taxRateBasisPoints: { type: 'integer' }, isActive: { type: 'boolean' },
    version: { type: 'integer', minimum: 1 },
    snapshot: {
      type: 'object', additionalProperties: false,
      required: [
        'productId', 'description', 'priceMinorUnits', 'currencyCode',
        'taxRateBasisPoints', 'unitCode', 'unitScale'
      ],
      properties: {
        productId: { type: 'string' }, description: { type: 'string' },
        priceMinorUnits: { type: 'integer' }, currencyCode: { type: 'string' },
        taxRateBasisPoints: { type: 'integer' }, unitCode: { type: 'string' },
        unitScale: { type: 'integer', minimum: 0 }
      }
    }
  }
} as const;

const productParams = {
  type: 'object', additionalProperties: false, required: ['productId'],
  properties: { productId: { type: 'string', minLength: 1, maxLength: 128 } }
} as const;

const mutationResponses = {
  200: productResponseSchema, 400: problemDetailsSchema, 401: problemDetailsSchema,
  403: problemDetailsSchema, 404: problemDetailsSchema, 409: problemDetailsSchema,
  503: problemDetailsSchema
} as const;

export const listProductsContract = {
  method: 'GET', path: '/api/v1/catalog/products', permission: null, idempotency: 'NONE',
  schema: {
    querystring: {
      type: 'object', additionalProperties: false,
      properties: { query: { type: 'string', maxLength: 200 } }
    },
    response: {
      200: { type: 'array', items: productResponseSchema },
      401: problemDetailsSchema
    }
  },
  errorCodes: ['UNAUTHORIZED']
} as const satisfies HttpContractV1;

export type CategoryResponse = { readonly id: string; readonly name: string };

const categoryResponseSchema = {
  type: 'object', additionalProperties: false, required: ['id', 'name'],
  properties: { id: { type: 'string' }, name: { type: 'string' } }
} as const;

export const listCategoriesContract = {
  method: 'GET', path: '/api/v1/catalog/categories', permission: null, idempotency: 'NONE',
  schema: {
    response: {
      200: { type: 'array', items: categoryResponseSchema },
      401: problemDetailsSchema
    }
  },
  errorCodes: ['UNAUTHORIZED']
} as const satisfies HttpContractV1;

export type UnitOfMeasureResponse = { readonly code: string; readonly name: string; readonly quantityScale: number };

const unitOfMeasureResponseSchema = {
  type: 'object', additionalProperties: false, required: ['code', 'name', 'quantityScale'],
  properties: {
    code: { type: 'string' }, name: { type: 'string' }, quantityScale: { type: 'integer' }
  }
} as const;

export const listUnitsOfMeasureContract = {
  method: 'GET', path: '/api/v1/catalog/units', permission: null, idempotency: 'NONE',
  schema: {
    response: {
      200: { type: 'array', items: unitOfMeasureResponseSchema },
      401: problemDetailsSchema
    }
  },
  errorCodes: ['UNAUTHORIZED']
} as const satisfies HttpContractV1;

export const getPriceHistoryContract = {
  method: 'GET', path: '/api/v1/catalog/products/:productId/price-history',
  permission: null, idempotency: 'NONE',
  schema: {
    params: productParams,
    response: {
      200: { type: 'array', items: {
        type: 'object', additionalProperties: false,
        required: ['id', 'priceMinorUnits', 'currencyCode', 'recordedAt', 'recordedBy', 'reason'],
        properties: {
          id: { type: 'string' }, priceMinorUnits: { type: 'integer' },
          currencyCode: { type: 'string' }, recordedAt: { type: 'string', format: 'date-time' },
          recordedBy: { type: 'string' }, reason: { type: 'string' }
        }
      } },
      401: problemDetailsSchema, 404: problemDetailsSchema
    }
  },
  errorCodes: ['UNAUTHORIZED', 'PRODUCT_NOT_FOUND']
} as const satisfies HttpContractV1;

export const createProductContract = {
  method: 'POST', path: '/api/v1/catalog/products',
  permission: 'catalog.product.create', idempotency: 'REQUIRED',
  schema: {
    headers: idempotencyHeaders,
    body: {
      type: 'object', additionalProperties: false,
      required: [
        'name', 'description', 'categoryId', 'unitCode', 'barcodes',
        'priceMinorUnits', 'currencyCode', 'taxRateBasisPoints', 'reason'
      ],
      properties: {
        name: { type: 'string', minLength: 1, maxLength: 200 },
        description: { type: 'string', minLength: 1, maxLength: 500 },
        categoryId: { type: 'string', minLength: 1, maxLength: 128 },
        unitCode: { type: 'string', minLength: 1, maxLength: 32 },
        barcodes: { type: 'array', uniqueItems: true, items: { type: 'string', minLength: 1, maxLength: 128 } },
        priceMinorUnits: { type: 'integer', minimum: 0 },
        currencyCode: { type: 'string', pattern: '^[A-Z]{3,8}$' },
        taxRateBasisPoints: { type: 'integer', minimum: 0, maximum: 10000 },
        reason: { type: 'string', minLength: 1, maxLength: 500 }
      }
    },
    response: { 201: productResponseSchema, ...mutationResponses }
  },
  errorCodes: [
    'HTTP_VALIDATION_FAILED', 'UNAUTHORIZED', 'FORBIDDEN', 'CATEGORY_NOT_FOUND',
    'UNIT_OF_MEASURE_NOT_FOUND', 'BARCODE_CONFLICT', 'IDEMPOTENCY_KEY_CONFLICT',
    'DATABASE_BUSY'
  ]
} as const satisfies HttpContractV1;

export const updateProductContract = {
  method: 'PATCH', path: '/api/v1/catalog/products/:productId',
  permission: 'catalog.product.update', idempotency: 'REQUIRED',
  schema: {
    params: productParams, headers: idempotencyHeaders,
    body: {
      type: 'object', additionalProperties: false, required: ['reason'],
      anyOf: [
        { required: ['name'] }, { required: ['description'] }, { required: ['categoryId'] },
        { required: ['unitCode'] }, { required: ['barcodes'] }, { required: ['isActive'] }
      ],
      properties: {
        name: { type: 'string', minLength: 1, maxLength: 200 },
        description: { type: 'string', minLength: 1, maxLength: 500 },
        categoryId: { type: 'string', minLength: 1, maxLength: 128 },
        unitCode: { type: 'string', minLength: 1, maxLength: 32 },
        barcodes: { type: 'array', uniqueItems: true, items: { type: 'string', minLength: 1, maxLength: 128 } },
        isActive: { type: 'boolean' }, reason: { type: 'string', minLength: 1, maxLength: 500 }
      }
    },
    response: mutationResponses
  },
  errorCodes: [
    'HTTP_VALIDATION_FAILED', 'UNAUTHORIZED', 'FORBIDDEN', 'PRODUCT_NOT_FOUND',
    'CATEGORY_NOT_FOUND', 'UNIT_OF_MEASURE_NOT_FOUND', 'BARCODE_CONFLICT',
    'IDEMPOTENCY_KEY_CONFLICT', 'DATABASE_BUSY'
  ]
} as const satisfies HttpContractV1;

export const updatePriceContract = {
  method: 'PUT', path: '/api/v1/catalog/products/:productId/price',
  permission: 'catalog.price.update', idempotency: 'REQUIRED',
  schema: {
    params: productParams, headers: idempotencyHeaders,
    body: {
      type: 'object', additionalProperties: false,
      required: ['priceMinorUnits', 'currencyCode', 'reason'],
      properties: {
        priceMinorUnits: { type: 'integer', minimum: 0 },
        currencyCode: { type: 'string', pattern: '^[A-Z]{3,8}$' },
        reason: { type: 'string', minLength: 1, maxLength: 500 }
      }
    },
    response: mutationResponses
  },
  errorCodes: [
    'HTTP_VALIDATION_FAILED', 'UNAUTHORIZED', 'FORBIDDEN', 'PRODUCT_NOT_FOUND',
    'IDEMPOTENCY_KEY_CONFLICT', 'DATABASE_BUSY'
  ]
} as const satisfies HttpContractV1;

export const findProductByBarcodeContract = {
  method: 'GET', path: '/api/v1/catalog/products/by-barcode/:barcode',
  permission: null, idempotency: 'NONE',
  schema: {
    params: {
      type: 'object', additionalProperties: false, required: ['barcode'],
      properties: { barcode: { type: 'string', minLength: 1, maxLength: 128 } }
    },
    response: {
      200: {
        type: 'object', additionalProperties: false, required: ['product', 'snapshot'],
        properties: { product: productResponseSchema, snapshot: productResponseSchema.properties.snapshot }
      },
      400: problemDetailsSchema, 401: problemDetailsSchema, 404: problemDetailsSchema
    }
  },
  errorCodes: ['HTTP_VALIDATION_FAILED', 'UNAUTHORIZED', 'PRODUCT_NOT_FOUND']
} as const satisfies HttpContractV1;
