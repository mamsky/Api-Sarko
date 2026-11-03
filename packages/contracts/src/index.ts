/**
 * @sarko/contracts — SATU-SATUNYA sumber kebenaran untuk skema request/response.
 *
 * Aturan (Plan §5.1): tidak ada skema yang ditulis dua kali.
 * Backend memvalidasi request dengan schema ini, admin meng-infer tipe dari schema ini,
 * dan mobile memakai schema yang sama untuk validasi offline.
 */
export * from './common/identifiers.js';
export * from './common/money.js';
export * from './common/pagination.js';
export * from './common/problem-detail.js';

export * from './identity/device.schema.js';
export * from './identity/login.schema.js';

export * from './catalog/product.schema.js';
export * from './catalog/recipe.schema.js';

export * from './ordering/order-status.enum.js';
export * from './ordering/create-order.schema.js';
export * from './ordering/order.schema.js';

export * from './payment/payment.schema.js';

export * from './sync/push.schema.js';
export * from './sync/pull.schema.js';
