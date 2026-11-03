import {
  ORDER_STATUS_TRANSITIONS,
  ORDER_STATUS_VALUES,
  type OrderStatus,
} from '@sarko/contracts';

import { AppError } from '../../shared/errors/app-error';
import { OrderStateMachine } from './order-state.machine';

const ALL_STATUSES: readonly OrderStatus[] = ORDER_STATUS_VALUES;

/**
 * Jumlah transisi legal dihitung dari `ORDER_STATUS_TRANSITIONS` (kontrak),
 * bukan ditulis manual: DRAFT 2 + PENDING_PAYMENT 3 + PAID 2 + IN_KITCHEN 2
 * + READY 2 = 11 legal, sehingga 70 pasangan ilegal dari 81 kombinasi.
 * Brief menyebut "12 legal / 69 ilegal" — angka itu tidak cocok dengan tabel
 * kontrak, dan kontrak yang menang (tidak boleh didefinisikan ulang).
 */
const EXPECTED_LEGAL_TRANSITIONS = 11;

function legalPairs(): [OrderStatus, OrderStatus][] {
  const pairs: [OrderStatus, OrderStatus][] = [];
  for (const from of ALL_STATUSES) {
    for (const to of ORDER_STATUS_TRANSITIONS[from]) {
      pairs.push([from, to]);
    }
  }
  return pairs;
}

describe('OrderStateMachine', () => {
  const legal = legalPairs();
  const legalSet = new Set(legal.map(([from, to]) => `${from}->${to}`));

  it('tabel transisi kontrak berisi 11 transisi legal', () => {
    expect(legal).toHaveLength(EXPECTED_LEGAL_TRANSITIONS);
  });

  it('menolak 70 pasangan ilegal dari 81 kombinasi', () => {
    expect(ALL_STATUSES).toHaveLength(9);
    expect(81 - legal.length).toBe(70);
  });

  describe.each(ALL_STATUSES)('dari status %s', (from) => {
    it.each(ALL_STATUSES)('ke %s mengikuti tabel kontrak', (to) => {
      const key = `${from}->${to}`;
      if (legalSet.has(key)) {
        expect(() => OrderStateMachine.assertTransition(from, to)).not.toThrow();
        expect(OrderStateMachine.canTransition(from, to)).toBe(true);
      } else {
        expect(() => OrderStateMachine.assertTransition(from, to)).toThrow(AppError);
        expect(OrderStateMachine.canTransition(from, to)).toBe(false);
      }
    });
  });

  it('transisi ilegal menghasilkan kode ORDER_INVALID_TRANSITION dengan status 409', () => {
    try {
      OrderStateMachine.assertTransition('COMPLETED', 'PAID');
      throw new Error('seharusnya melempar');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      const appError = error as AppError;
      expect(appError.code).toBe('ORDER_INVALID_TRANSITION');
      expect(appError.status).toBe(409);
    }
  });

  it('menolak transisi ke status yang sama (idempoten bukan urusan state machine)', () => {
    for (const status of ALL_STATUSES) {
      expect(() => OrderStateMachine.assertTransition(status, status)).toThrow(AppError);
    }
  });

  it('nextStatuses mengembalikan salinan tabel, bukan referensi internal', () => {
    const next = OrderStateMachine.nextStatuses('PAID');
    expect(next).toEqual(['IN_KITCHEN', 'VOID']);
    next.push('COMPLETED');
    expect(OrderStateMachine.nextStatuses('PAID')).toEqual(['IN_KITCHEN', 'VOID']);
  });

  it('menandai 4 status terminal dan 5 non-terminal', () => {
    const terminal = ALL_STATUSES.filter((status) => OrderStateMachine.isTerminal(status));
    expect(terminal.sort()).toEqual(['CANCELLED', 'COMPLETED', 'EXPIRED', 'VOID']);
    expect(ALL_STATUSES.filter((status) => !OrderStateMachine.isTerminal(status))).toHaveLength(5);
  });

  it('requiresPayment true hanya untuk status yang sudah dibayar', () => {
    const paid = ALL_STATUSES.filter((status) => OrderStateMachine.requiresPayment(status));
    expect(paid.sort()).toEqual(['COMPLETED', 'IN_KITCHEN', 'PAID', 'READY']);
    expect(OrderStateMachine.requiresPayment('PENDING_PAYMENT')).toBe(false);
    expect(OrderStateMachine.requiresPayment('DRAFT')).toBe(false);
  });

  it('status awal ditentukan metode pembayaran', () => {
    expect(OrderStateMachine.initialStatus('CASH')).toBe('PAID');
    expect(OrderStateMachine.initialStatus('QRIS')).toBe('PENDING_PAYMENT');
    expect(OrderStateMachine.initialStatus('VA')).toBe('PENDING_PAYMENT');
    expect(OrderStateMachine.initialStatus('EWALLET')).toBe('PENDING_PAYMENT');
    expect(OrderStateMachine.initialStatus('CARD')).toBe('PENDING_PAYMENT');
  });

  it('setiap status terminal tidak punya transisi keluar', () => {
    for (const status of ALL_STATUSES) {
      if (OrderStateMachine.isTerminal(status)) {
        expect(OrderStateMachine.nextStatuses(status)).toHaveLength(0);
      }
    }
  });
});
