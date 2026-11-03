import { createHmac } from 'node:crypto';

import type { WebhookPayload } from '@sarko/contracts';

import { PaymentService } from './payment.service';

const SECRET = 'test-webhook-secret';
const ORDER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PAYMENT_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

type OrderRow = {
  id: string;
  outletId: string;
  orderNo: string;
  status: string;
  total: number;
  customerId: string | null;
  items: { productId: string; qty: number }[];
};

function makeOrder(overrides: Partial<OrderRow> = {}): OrderRow {
  return {
    id: ORDER_ID,
    outletId: '11111111-1111-4111-8111-111111111111',
    orderNo: 'OFF-KTA-P1-00001',
    status: 'PENDING_PAYMENT',
    total: 19_800,
    customerId: null,
    items: [{ productId: '22222222-2222-4222-8222-222222222222', qty: 1 }],
    ...overrides,
  };
}

function build(order: OrderRow = makeOrder()) {
  const payments = {
    transaction: jest.fn(async (work: (tx: unknown) => Promise<unknown>) => work({})),
    findById: jest.fn(async () => ({
      id: PAYMENT_ID,
      outletId: order.outletId,
      orderId: order.id,
      method: 'QRIS',
      amount: order.total,
      status: 'PAID',
      gatewayReference: 'ref-1',
      idempotencyKey: 'idem-1',
      gatewayPayload: null,
      paidAt: new Date(),
      failedAt: null,
      expiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
    findByIdempotencyKey: jest.fn(async () => undefined),
    findByGatewayReference: jest.fn(async (): Promise<Record<string, unknown> | undefined> => undefined),
    insert: jest.fn(async (_tx: unknown, values: Record<string, unknown>) => ({
      id: PAYMENT_ID,
      createdAt: new Date(),
      paidAt: null,
      ...values,
    })),
    markPaid: jest.fn(async () => undefined),
    markFailed: jest.fn(async () => undefined),
    insertRefund: jest.fn(async (_tx: unknown, values: Record<string, unknown>) => ({
      id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      ...values,
    })),
    sumRefunds: jest.fn(async () => 0),
    listByOrder: jest.fn(async () => []),
    logWebhook: jest.fn(async () => undefined),
    recordMismatch: jest.fn(async () => undefined),
    listRefunds: jest.fn(async () => []),
    listPendingReconciliation: jest.fn(async () => []),
  };

  const orders = {
    findById: jest.fn(async () => order),
    updateStatus: jest.fn(async () => undefined),
    recordStatusHistory: jest.fn(async () => undefined),
  };

  const inventory = { deduct: jest.fn(async () => []) };
  const outbox = { enqueue: jest.fn(async () => undefined) };

  const service = new PaymentService(
    payments as never,
    orders as never,
    inventory as never,
    outbox as never,
    { loyaltyRupiahPerPoint: 1_000 },
  );

  return { service, payments, orders, inventory, outbox };
}

function sign(rawBody: string, secret = SECRET): string {
  return createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
}

function webhookPayload(overrides: Partial<WebhookPayload> = {}): WebhookPayload {
  return {
    event: 'payment.paid',
    reference: 'ref-1',
    order_id: ORDER_ID,
    amount: 19_800,
    paid_at: new Date().toISOString(),
    signature: 'ignored-in-body',
    ...overrides,
  } as WebhookPayload;
}

describe('PaymentService', () => {
  it('menolak webhook dengan signature salah', async () => {
    const h = build();
    const payload = webhookPayload();
    const rawBody = JSON.stringify(payload);

    await expect(
      h.service.handleWebhook(payload, {
        rawBody,
        signature: 'deadbeef',
        secret: SECRET,
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    expect(h.payments.markPaid).not.toHaveBeenCalled();
    expect(h.inventory.deduct).not.toHaveBeenCalled();
    expect(h.payments.logWebhook).toHaveBeenCalledWith(
      expect.objectContaining({ signatureValid: false }),
    );
  });

  it('memproses webhook valid: payment PAID, order PAID, stok dipotong, outbox ditulis', async () => {
    const h = build();
    const payload = webhookPayload();
    const rawBody = JSON.stringify(payload);

    const result = await h.service.handleWebhook(payload, {
      rawBody,
      signature: sign(rawBody),
      secret: SECRET,
    });

    expect(result.processed).toBe(true);
    expect(h.payments.markPaid).toHaveBeenCalledTimes(1);
    expect(h.orders.updateStatus).toHaveBeenCalledWith(
      expect.anything(),
      ORDER_ID,
      'PAID',
      expect.anything(),
    );
    expect(h.inventory.deduct).toHaveBeenCalledTimes(1);
    expect(h.outbox.enqueue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: 'order.paid' }),
    );
  });

  it('webhook replay tidak menggandakan efek (idempoten)', async () => {
    const h = build();
    h.payments.findByGatewayReference.mockResolvedValue({
      id: PAYMENT_ID,
      outletId: 'outlet',
      orderId: ORDER_ID,
      method: 'QRIS',
      amount: 19_800,
      status: 'PAID',
      gatewayReference: 'ref-1',
      idempotencyKey: null,
      gatewayPayload: null,
      paidAt: new Date(),
      failedAt: null,
      expiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const payload = webhookPayload();
    const rawBody = JSON.stringify(payload);
    const result = await h.service.handleWebhook(payload, {
      rawBody,
      signature: sign(rawBody),
      secret: SECRET,
    });

    expect(result.processed).toBe(false);
    expect(h.inventory.deduct).not.toHaveBeenCalled();
    expect(h.outbox.enqueue).not.toHaveBeenCalled();
  });

  it('menolak webhook dengan nominal berbeda dari total order', async () => {
    const h = build();
    const payload = webhookPayload({ amount: 1_000 });
    const rawBody = JSON.stringify(payload);

    await expect(
      h.service.handleWebhook(payload, { rawBody, signature: sign(rawBody), secret: SECRET }),
    ).rejects.toMatchObject({ code: 'TOTAL_MISMATCH' });

    expect(h.payments.recordMismatch).toHaveBeenCalledTimes(1);
    expect(h.inventory.deduct).not.toHaveBeenCalled();
  });

  it('refund ditolak untuk order yang belum dibayar', async () => {
    const h = build(makeOrder({ status: 'PENDING_PAYMENT' }));

    await expect(
      h.service.refund('actor-1', {
        payment_id: PAYMENT_ID,
        amount: 5_000,
        reason: 'pelanggan batal',
      }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('refund membuat baris refund + outbox untuk order yang sudah dibayar', async () => {
    const h = build(makeOrder({ status: 'PAID' }));

    const result = await h.service.refund('actor-1', {
      payment_id: PAYMENT_ID,
      amount: 5_000,
      reason: 'pesanan tidak sesuai',
    });

    expect(result.status).toBe('REQUESTED');
    expect(h.payments.insertRefund).toHaveBeenCalledTimes(1);
    expect(h.outbox.enqueue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: 'refund.requested' }),
    );
  });

  it('refund melebihi sisa pembayaran ditolak', async () => {
    const h = build(makeOrder({ status: 'PAID' }));
    h.payments.sumRefunds.mockResolvedValue(18_000);

    await expect(
      h.service.refund('actor-1', {
        payment_id: PAYMENT_ID,
        amount: 5_000,
        reason: 'refund sebagian',
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('create menolak nominal yang tidak sama dengan total order', async () => {
    const h = build();
    await expect(
      h.service.create('actor-1', {
        order_id: ORDER_ID,
        method: 'QRIS',
        amount: 1_000,
        idempotency_key: 'idem-x',
      }),
    ).rejects.toMatchObject({ code: 'TOTAL_MISMATCH' });
  });

  it('verifySignature menerima header berprefix sha256=', () => {
    const h = build();
    const rawBody = '{"a":1}';
    const digest = sign(rawBody);
    expect(h.service.verifySignature(rawBody, `sha256=${digest}`, SECRET)).toBe(true);
    expect(h.service.verifySignature(rawBody, digest, SECRET)).toBe(true);
    expect(h.service.verifySignature(rawBody, sign(rawBody, 'secret-lain'), SECRET)).toBe(false);
  });
});
