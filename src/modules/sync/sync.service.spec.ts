import type { SyncCommand, SyncPushRequest } from '@sarko/contracts';

import { AppError } from '../../shared/errors/app-error';
import { SyncService } from './sync.service';

const OUTLET_ID = '11111111-1111-4111-8111-111111111111';
const ORDER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function command(overrides: Partial<SyncCommand> = {}): SyncCommand {
  return {
    command_id: '01JCV3X8Z9K2M4N6P8Q0R2S4T6',
    type: 'CREATE_ORDER',
    aggregate_id: ORDER_ID,
    payload: {
      items: [{ product_id: '22222222-2222-4222-8222-222222222222', qty: 1 }],
      payment: { method: 'CASH', cash_received: 20_000 },
      total: 19_800,
      channel: 'POS',
      fulfillment: 'DINE_IN',
    },
    created_at: new Date().toISOString(),
    ...overrides,
  } as SyncCommand;
}

function pushRequest(commands: SyncCommand[]): SyncPushRequest {
  return {
    device_id: 'dev_kta_p1',
    outlet_id: OUTLET_ID,
    app_version: '1.3.0',
    commands,
  } as SyncPushRequest;
}

function build() {
  const storedCommands = new Map<string, { aggregateId: string; responseBody: unknown }>();

  const sync = {
    findCommand: jest.fn(async (commandId: string) => {
      const found = storedCommands.get(commandId);
      return found === undefined
        ? undefined
        : {
            id: 'log-1',
            outletId: OUTLET_ID,
            deviceId: 'dev_kta_p1',
            commandId,
            commandType: 'CREATE_ORDER',
            aggregateId: found.aggregateId,
            payloadHash: 'hash',
            result: 'CREATED',
            httpStatus: 200,
            responseBody: found.responseBody,
            processedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          };
    }),
    insertCommand: jest.fn(async (values: { commandId: string; aggregateId: string }) => {
      storedCommands.set(values.commandId, {
        aggregateId: values.aggregateId,
        responseBody: { status: 'CREATED' },
      });
    }),
    recordConflict: jest.fn(async () => undefined),
    listEventsSince: jest.fn(
      async (): Promise<{ id: string; eventType: string; createdAt: Date }[]> => [],
    ),
    listProducts: jest.fn(async (): Promise<Record<string, unknown>[]> => []),
    listTaxConfig: jest.fn(async (): Promise<Record<string, unknown>[]> => []),
    listOtherChannelOrders: jest.fn(async (): Promise<Record<string, unknown>[]> => []),
    currentMenuVersion: jest.fn(async () => '0-0'),
    setProductAvailability: jest.fn(async () => undefined),
    deviceStats: jest.fn(async () => ({
      queueDepth: 0,
      failedPermanent: 0,
      lastPushAt: null,
      lastPullAt: null,
      menuVersion: '0-0',
    })),
    recordHeartbeat: jest.fn(async () => undefined),
  };

  const orders = { findById: jest.fn(async () => undefined) };
  const inventory = { deduct: jest.fn(async () => []) };

  const ordering = {
    create: jest.fn(async () => ({
      id: ORDER_ID,
      order_no: 'OFF-KTA-P1-00001',
      total: 19_800,
      status: 'PAID',
      client_order_id: '01JCV3X8Z9K2M4N6P8Q0R2S4T6',
    })),
    updateItemStatus: jest.fn(async () => undefined),
  };

  const service = new SyncService(
    sync as never,
    orders as never,
    ordering as never,
    inventory as never,
  );

  return { service, sync, orders, ordering, inventory, storedCommands };
}

describe('SyncService', () => {
  it('command duplikat mengembalikan DUPLICATE tanpa efek samping ganda', async () => {
    const h = build();
    h.storedCommands.set('01JCV3X8Z9K2M4N6P8Q0R2S4T6', {
      aggregateId: ORDER_ID,
      responseBody: { status: 'CREATED' },
    });

    const response = await h.service.push(pushRequest([command()]));

    expect(response.results).toHaveLength(1);
    expect(response.results[0]).toMatchObject({ status: 'DUPLICATE', aggregate_id: ORDER_ID });
    expect(h.ordering.create).not.toHaveBeenCalled();
    expect(h.sync.insertCommand).not.toHaveBeenCalled();
  });

  it('memproses batch 50 command dan mengembalikan satu hasil per command', async () => {
    const h = build();
    const commands = Array.from({ length: 50 }, (_, index) =>
      command({
        command_id: `01JCV3X8Z9K2M4N6P8Q0R2S4${String(index).padStart(2, '0')}`,
      }),
    );

    const response = await h.service.push(pushRequest(commands));

    expect(response.results).toHaveLength(50);
    expect(response.results.every((result) => result.status === 'CREATED')).toBe(true);
    expect(h.ordering.create).toHaveBeenCalledTimes(50);
  });

  it('command tidak valid menghasilkan REJECTED dengan kode, bukan melempar', async () => {
    const h = build();
    h.ordering.create.mockRejectedValueOnce(AppError.validation('Produk tidak ditemukan'));

    const response = await h.service.push(pushRequest([command()]));

    expect(response.results[0]).toMatchObject({
      status: 'REJECTED',
      code: 'VALIDATION_FAILED',
    });
    expect(h.sync.insertCommand).toHaveBeenCalledWith(
      expect.objectContaining({ result: 'REJECTED', httpStatus: 400 }),
    );
  });

  it('selisih total menjadi warning TOTAL_MISMATCH, command tetap CREATED', async () => {
    const h = build();
    h.ordering.create.mockResolvedValueOnce({
      id: ORDER_ID,
      order_no: 'OFF-KTA-P1-00001',
      total: 21_780,
      status: 'PAID',
      client_order_id: '01JCV3X8Z9K2M4N6P8Q0R2S4T6',
    });

    const response = await h.service.push(
      pushRequest([
        command({
          payload: {
            items: [{ product_id: '22222222-2222-4222-8222-222222222222', qty: 1 }],
            payment: { method: 'CASH', cash_received: 25_000 },
            total: 19_800,
          },
        }),
      ]),
    );

    expect(response.results[0]?.status).toBe('CREATED');
    expect(response.results[0]?.warnings[0]).toMatchObject({
      code: 'TOTAL_MISMATCH',
      client_total: 19_800,
      server_total: 21_780,
    });
    expect(h.sync.recordConflict).toHaveBeenCalledTimes(1);
  });

  it('pull memajukan cursor ke event terakhir', async () => {
    const h = build();
    const since = '2026-11-02T00:00:00.000Z';
    h.sync.listEventsSince.mockResolvedValueOnce([
      { id: 'event-1', eventType: 'order.created', createdAt: new Date('2026-11-02T01:00:00Z') },
      { id: 'event-2', eventType: 'order.paid', createdAt: new Date('2026-11-02T02:00:00Z') },
    ]);

    const response = await h.service.pull({
      since,
      outlet_id: OUTLET_ID,
      device_id: 'dev_kta_p1',
    });

    expect(response.next_event_id).toBe('event-2');
    expect(response.has_more).toBe(false);
    expect(h.sync.listEventsSince).toHaveBeenCalledWith(OUTLET_ID, new Date(since), 101);
  });

  it('pull menandai has_more saat event melebihi satu halaman', async () => {
    const h = build();
    const events = Array.from({ length: 101 }, (_, index) => ({
      id: `event-${index}`,
      eventType: 'order.created',
      createdAt: new Date(2026, 10, 2, 1, index),
    }));
    h.sync.listEventsSince.mockResolvedValueOnce(events);

    const response = await h.service.pull({
      since: '2026-11-02T00:00:00.000Z',
      outlet_id: OUTLET_ID,
      device_id: 'dev_kta_p1',
    });

    expect(response.has_more).toBe(true);
    expect(response.next_event_id).toBe('event-99');
  });

  it('pull menolak since yang tidak valid', async () => {
    const h = build();
    await expect(
      h.service.pull({ since: 'bukan-tanggal', outlet_id: OUTLET_ID, device_id: 'dev_kta_p1' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('command yang gagal tak terduga menghasilkan RETRY (tidak hilang diam-diam)', async () => {
    const h = build();
    h.ordering.create.mockRejectedValueOnce(new Error('koneksi database putus'));

    const response = await h.service.push(pushRequest([command()]));

    expect(response.results[0]).toMatchObject({ status: 'RETRY' });
  });

  it('meneruskan order_id dan order_no dari device apa adanya (PRD §7.12.5)', async () => {
    const h = build();

    await h.service.push(
      pushRequest([
        command({
          payload: {
            items: [{ product_id: '22222222-2222-4222-8222-222222222222', qty: 1 }],
            payment: { method: 'CASH', cash_received: 25_000 },
            order_id: '11111111-2222-4333-8444-555555555555',
            order_no: 'OFF-KTA-P1-00099',
          },
        }),
      ]),
    );

    expect(h.ordering.create).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        order_id: '11111111-2222-4333-8444-555555555555',
        order_no: 'OFF-KTA-P1-00099',
      }),
      expect.anything(),
    );
  });

  it('order_no duplikat ditolak sebagai REJECTED, bukan ditimpa', async () => {
    const h = build();
    h.ordering.create.mockRejectedValueOnce(
      AppError.conflict('Nomor order OFF-KTA-P1-00099 sudah dipakai order lain'),
    );

    const response = await h.service.push(
      pushRequest([
        command({
          payload: {
            items: [{ product_id: '22222222-2222-4222-8222-222222222222', qty: 1 }],
            payment: { method: 'CASH', cash_received: 25_000 },
            order_no: 'OFF-KTA-P1-00099',
          },
        }),
      ]),
    );

    expect(response.results[0]).toMatchObject({
      status: 'REJECTED',
      code: 'CONFLICT',
    });
  });

  it('pull mengembalikan order kanal lain lengkap dengan item', async () => {
    const h = build();
    h.sync.listOtherChannelOrders.mockResolvedValueOnce([
      { id: ORDER_ID, channel: 'MOBILE_APP' },
    ] as never);
    h.orders.findById.mockResolvedValueOnce({
      id: ORDER_ID,
      orderNo: 'OFF-KTA-P1-00008',
      outletId: OUTLET_ID,
      channel: 'MOBILE_APP',
      fulfillment: 'DELIVERY',
      tableLabel: null,
      status: 'PENDING_PAYMENT',
      items: [
        {
          id: '33333333-3333-4333-8333-333333333333',
          productId: '22222222-2222-4222-8222-222222222222',
          productName: 'Kopi Butter',
          qty: 1,
          unitPrice: 18_000,
          subtotal: 18_000,
          notes: null,
          station: 'KOPI',
          status: 'PENDING',
          modifiers: [],
        },
      ],
      subtotal: 18_000,
      discount: 0,
      tax: 1_800,
      total: 19_800,
      paymentMethod: 'QRIS',
      paidAt: null,
      createdAt: new Date('2026-11-03T02:18:24.789Z'),
      syncedAt: new Date('2026-11-03T02:18:24.789Z'),
      businessDate: '2026-11-03',
      clientOrderId: '01M6FK6P0RBK5NT3PYA1Z4MP17',
    } as never);

    const response = await h.service.pull({
      since: '2026-01-01T00:00:00.000Z',
      outlet_id: OUTLET_ID,
      device_id: 'dev_kta_p1',
    });

    expect(response.changes.orders).toHaveLength(1);
    expect(response.changes.orders[0]).toMatchObject({
      order_no: 'OFF-KTA-P1-00008',
      channel: 'MOBILE_APP',
      total: 19_800,
    });
    expect(response.changes.orders[0]?.items).toHaveLength(1);
  });

  it('health mengembalikan bentuk yang diharapkan klien', async () => {
    const h = build();
    const health = await h.service.health('dev_kta_p1');

    expect(health).toEqual({
      queue_depth: 0,
      failed_permanent: 0,
      last_push_at: null,
      last_pull_at: null,
      menu_version: '0-0',
      clock_skew_ms: 0,
    });
  });
});
