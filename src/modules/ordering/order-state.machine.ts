import {
  canTransition,
  isTerminal,
  ORDER_STATUS_TRANSITIONS,
  PAID_STATUSES,
  type OrderStatus,
} from '@sarko/contracts';

import { AppError } from '../../shared/errors/app-error';

/**
 * SATU-SATUNYA tempat transisi status order divalidasi (PRD §7.4, plan §2.2).
 *
 * Tabel transisinya milik `@sarko/contracts` — file ini tidak mendefinisikan
 * ulang aturan, hanya menegakkan dan memberi helper turunan.
 */
export class OrderStateMachine {
  static assertTransition(from: OrderStatus, to: OrderStatus): void {
    if (from === to) {
      throw AppError.invalidTransition(from, to);
    }
    if (!canTransition(from, to)) {
      throw AppError.invalidTransition(from, to);
    }
  }

  static canTransition(from: OrderStatus, to: OrderStatus): boolean {
    return from !== to && canTransition(from, to);
  }

  static nextStatuses(from: OrderStatus): OrderStatus[] {
    return [...ORDER_STATUS_TRANSITIONS[from]];
  }

  static isTerminal(status: OrderStatus): boolean {
    return isTerminal(status);
  }

  /** Status yang berarti uang sudah masuk — syarat refund/void setelah bayar. */
  static requiresPayment(status: OrderStatus): boolean {
    return PAID_STATUSES.includes(status);
  }

  /** Status awal setelah checkout: tunai langsung PAID, non-tunai menunggu gateway. */
  static initialStatus(paymentMethod: string): OrderStatus {
    return paymentMethod === 'CASH' ? 'PAID' : 'PENDING_PAYMENT';
  }
}
