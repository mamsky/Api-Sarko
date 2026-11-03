import { z } from 'zod';

/**
 * 9 status order SARKO (PRD §7.4) — DIDEfinisikan SEKALI di sini.
 * Backend, admin, KDS, dan mobile WAJIB mengimpor dari modul ini.
 */
export const ORDER_STATUS = {
  DRAFT: 'DRAFT',
  PENDING_PAYMENT: 'PENDING_PAYMENT',
  PAID: 'PAID',
  IN_KITCHEN: 'IN_KITCHEN',
  READY: 'READY',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  VOID: 'VOID',
  EXPIRED: 'EXPIRED',
} as const;

export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

export const orderStatusSchema = z.enum([
  'DRAFT',
  'PENDING_PAYMENT',
  'PAID',
  'IN_KITCHEN',
  'READY',
  'COMPLETED',
  'CANCELLED',
  'VOID',
  'EXPIRED',
]);

export const ORDER_STATUS_VALUES: readonly OrderStatus[] = [
  'DRAFT',
  'PENDING_PAYMENT',
  'PAID',
  'IN_KITCHEN',
  'READY',
  'COMPLETED',
  'CANCELLED',
  'VOID',
  'EXPIRED',
] as const;

/**
 * State machine legal. Transisi di luar tabel ini HARUS ditolak server
 * dengan problem code ORDER_INVALID_TRANSITION.
 */
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  DRAFT: ['PENDING_PAYMENT', 'CANCELLED'],
  PENDING_PAYMENT: ['PAID', 'EXPIRED', 'CANCELLED'],
  PAID: ['IN_KITCHEN', 'VOID'],
  IN_KITCHEN: ['READY', 'VOID'],
  READY: ['COMPLETED', 'VOID'],
  COMPLETED: [],
  CANCELLED: [],
  VOID: [],
  EXPIRED: [],
};

export const TERMINAL_STATUSES: readonly OrderStatus[] = [
  'COMPLETED',
  'CANCELLED',
  'VOID',
  'EXPIRED',
] as const;

/** Status yang dianggap sudah dibayar — dipakai guard refund/void setelah bayar. */
export const PAID_STATUSES: readonly OrderStatus[] = [
  'PAID',
  'IN_KITCHEN',
  'READY',
  'COMPLETED',
] as const;

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_STATUS_TRANSITIONS[from].includes(to);
}

export function isTerminal(status: OrderStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/** Label Indonesia untuk UI kasir, KDS, dan struk. */
export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  DRAFT: 'Draf',
  PENDING_PAYMENT: 'Menunggu Pembayaran',
  PAID: 'Dibayar',
  IN_KITCHEN: 'Di Dapur',
  READY: 'Siap Diambil',
  COMPLETED: 'Selesai',
  CANCELLED: 'Dibatalkan',
  VOID: 'Void',
  EXPIRED: 'Kedaluwarsa',
};

/** Warna badge/kolom Kanban — dipetakan ke token desain admin. */
export const ORDER_STATUS_COLOR: Record<
  OrderStatus,
  'neutral' | 'warning' | 'info' | 'success' | 'danger'
> = {
  DRAFT: 'neutral',
  PENDING_PAYMENT: 'warning',
  PAID: 'info',
  IN_KITCHEN: 'info',
  READY: 'success',
  COMPLETED: 'success',
  CANCELLED: 'neutral',
  VOID: 'danger',
  EXPIRED: 'danger',
};
