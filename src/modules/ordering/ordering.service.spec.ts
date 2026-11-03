import type { CreateOrderInput } from '@sarko/contracts';

import { AppError } from '../../shared/errors/app-error';
import { OrderingService } from './ordering.service';
import type { OrderWithItems } from './repositories/order.repository';

type Harness = {
  service: OrderingService;
  orders: ReturnType<typeof makeOrders>;
  products: ReturnType<typeof makeProducts>;
  outlets: ReturnType<typeof makeOutlets>;
  orderNumbers: ReturnType<typeof makeOrderNumbers>;
  inventory: ReturnType<typeof makeInventory>;
  outbox: ReturnType<typeof makeOutbox>;
};

const OUTLET_ID = '11111111-1111-4111-8111-111111111111';
const PRODUCT_ID = '22222222-2222-4222-8222-222222222222';
const OPTION_ID = '33333333-3333-4333-8333-333333333333';
const CLIENT_ORDER_ID = '01JCV3X8Z9K2M4N6P8Q0R2S4T6';

function makeOrderRow(overrides: Partial<OrderWithItems> = {}): OrderWithItems {
  const now = new Date('2026-11-02T02:00:00Z');
  return {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    outletId: OUTLET_ID,
    orderNo: 'OFF-KTA-P1-00001',
    clientOrderId: CLIENT_ORDER_ID,
    shiftId: null,
    deviceId: null,
    userId: null,
    customerId: null,
    tableId: null,
    tableLabel: 'Meja 04',
    channel: 'POS',
    fulfillment: 'DINE_IN',
    status: 'PAID',
    paymentMethod: 'CASH',
    subtotal: 18_000,
    discount: 0,
    serviceCharge: 0,
    tax: 1_800,
    roundingAdjustment: 0,
    total: 19_800,
    taxRateBps: 1000,
    cashReceived: 20_000,
    changeDue: 200,
    discountCode: null,
    notes: null,
    businessDate: '2026-11-02',
    clockSkewMs: null,
    paidAt: now,
    completedAt: null,
    cancelledAt: null,
    syncedAt: now,
    createdAt: now,
    updatedAt: now,
    items: [
      {
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        outletId: OUTLET_ID,
        orderId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        productId: PRODUCT_ID,
        productName: 'Kopi Butter',
        sku: 'KOPI-001',
        qty: 1,
        unitPrice: 18_000,
        modifierTotal: 0,
        subtotal: 18_000,
        station: 'KOPI',
        status: 'PENDING',
        notes: null,
        createdAt: now,
        updatedAt: now,
        modifiers: [],
      },
    ],
    ...overrides,
  } as OrderWithItems;
}

function makeOrders() {
  let stored: OrderWithItems | undefined;
  const inserted: Record<string, unknown>[] = [];
  const insertedItems: Record<string, unknown>[] = [];
  const repo = {
    transaction: jest.fn(async (work: (tx: unknown) => Promise<unknown>) => work({})),
    findByClientOrderId: jest.fn(async () => stored),
    findById: jest.fn(async () => stored),
    inserted,
    insertedItems,
    insert: jest.fn(async (_tx: unknown, values: Record<string, unknown>) => {
      inserted.push(values);
      stored = makeOrderRow({
        status: values.status as string,
        subtotal: values.subtotal as number,
        tax: values.tax as number,
        total: values.total as number,
        discount: values.discount as number,
      });
      return makeOrderRow();
    }),
    insertItems: jest.fn(async (_tx: unknown, values: Record<string, unknown>[]) => {
      insertedItems.push(...values);
      return [];
    }),
    insertItemModifiers: jest.fn(async () => undefined),
    recordStatusHistory: jest.fn(async () => undefined),
    updateStatus: jest.fn(async () => makeOrderRow()),
    updateItemStatus: jest.fn(async () => undefined),
    countItemsByStatus: jest.fn(async () => ({ total: 1, done: 1 })),
    list: jest.fn(async () => []),
    findStatusHistory: jest.fn(async () => []),
    __setStored: (row: OrderWithItems | undefined) => {
      stored = row;
    },
  };
  return repo;
}

function makeProducts() {
  return {
    findByIds: jest.fn(async () => [
      {
        id: PRODUCT_ID,
        outletId: OUTLET_ID,
        categoryId: 'cat',
        sku: 'KOPI-001',
        name: 'Kopi Butter',
        description: null,
        basePrice: 18_000,
        imageUrl: null,
        station: 'KOPI',
        isAvailable: true,
        prepTimeMinutes: 3,
        sortOrder: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        categoryName: 'Kopi',
        modifierGroups: [],
      },
    ]),
    findModifierOptions: jest.fn(async () => [
      {
        id: OPTION_ID,
        modifierGroupId: 'group',
        name: 'Large',
        priceDelta: 2_000,
        isDefault: false,
        sortOrder: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      },
    ]),
  };
}

function makeOutlets() {
  return {
    findById: jest.fn(async () => ({
      id: OUTLET_ID,
      code: 'KTA',
      name: 'SARKO Kartasura',
      address: null,
      phone: null,
      timezone: 'Asia/Jakarta',
      cutoffHour: 4,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    })),
    listActive: jest.fn(async () => [{ id: OUTLET_ID, code: 'KTA', cutoffHour: 4, timezone: 'Asia/Jakarta' }]),
    findActiveTaxConfig: jest.fn(async () => ({
      id: 'tax',
      outletId: OUTLET_ID,
      name: 'PB1',
      rateBps: 1000,
      serviceChargeBps: 0,
      isInclusive: 'false',
      isActive: 'true',
      effectiveFrom: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
    findActiveVoucher: jest.fn(async () => undefined),
  };
}

function makeOrderNumbers() {
  return {
    findActiveBlock: jest.fn(async () => ({
      id: 'block-1',
      rangeStart: 1,
      rangeEnd: 200,
      nextValue: 1,
    })),
    allocateBlock: jest.fn(async () => ({ id: 'block-1', rangeStart: 1, rangeEnd: 200, nextValue: 1 })),
    consume: jest.fn(async () => 1),
    returnBlock: jest.fn(async () => undefined),
  };
}

function makeInventory() {
  return {
    reserve: jest.fn(async () => ({ reserved: true, shortages: [] })),
    deduct: jest.fn(async () => []),
    restore: jest.fn(async () => undefined),
    recalculate: jest.fn(async () => 0),
    lowStock: jest.fn(async () => []),
  };
}

function makeOutbox() {
  return { enqueue: jest.fn(async () => undefined) };
}

function build(): Harness {
  const orders = makeOrders();
  const products = makeProducts();
  const outlets = makeOutlets();
  const orderNumbers = makeOrderNumbers();
  const inventory = makeInventory();
  const outbox = makeOutbox();

  const service = new OrderingService(
    orders as never,
    products as never,
    outlets as never,
    orderNumbers as never,
    inventory as never,
    outbox as never,
  );

  return { service, orders, products, outlets, orderNumbers, inventory, outbox };
}

function cashOrder(overrides: Partial<CreateOrderInput> = {}): CreateOrderInput {
  return {
    client_order_id: CLIENT_ORDER_ID,
    channel: 'POS',
    fulfillment: 'DINE_IN',
    table_label: 'Meja 04',
    items: [{ product_id: PRODUCT_ID, qty: 1, modifier_option_ids: [] }],
    payment_method: 'CASH',
    cash_received: 20_000,
    ...overrides,
  } as CreateOrderInput;
}

describe('OrderingService', () => {
  it('menghitung ulang harga dari DB, bukan memakai harga client', async () => {
    const h = build();

    const order = await h.service.create('actor-1', cashOrder());

    // base_price DB 18.000 — bukan angka yang mungkin dikirim client.
    expect(h.orders.inserted[0]).toMatchObject({ subtotal: 18_000 });
    expect(order.subtotal).toBe(18_000);
  });

  it('menghitung pajak sebagai persentase (10%), bukan nominal flat', async () => {
    const h = build();
    h.products.findByIds.mockResolvedValueOnce([
      {
        id: PRODUCT_ID,
        outletId: OUTLET_ID,
        categoryId: 'cat',
        sku: 'KOPI-001',
        name: 'Kopi Butter',
        description: null,
        basePrice: 50_000,
        imageUrl: null,
        station: 'KOPI',
        isAvailable: true,
        prepTimeMinutes: 3,
        sortOrder: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        categoryName: 'Kopi',
        modifierGroups: [],
      },
    ]);

    const order = await h.service.create('actor-1', cashOrder({ cash_received: 100_000 }));

    expect(order.subtotal).toBe(50_000);
    expect(order.tax).toBe(5_000);
    expect(order.total).toBe(55_000);
  });

  it('menolak transisi status ilegal lewat state machine', async () => {
    const h = build();
    h.orders.__setStored(makeOrderRow({ status: 'COMPLETED' }));

    await expect(h.service.transition('order-1', 'PAID', 'actor-1')).rejects.toMatchObject({
      code: 'ORDER_INVALID_TRANSITION',
      status: 409,
    });
  });

  it('order tunai (CASH) langsung berstatus PAID', async () => {
    const h = build();

    const order = await h.service.create('actor-1', cashOrder());

    expect(h.orders.inserted[0]).toMatchObject({ status: 'PAID', paymentMethod: 'CASH' });
    expect(order.status).toBe('PAID');
  });

  it('order QRIS berstatus PENDING_PAYMENT dan mereservasi stok', async () => {
    const h = build();

    const order = await h.service.create(
      'actor-1',
      cashOrder({ payment_method: 'QRIS', cash_received: undefined }),
    );

    expect(h.orders.inserted[0]).toMatchObject({ status: 'PENDING_PAYMENT' });
    expect(h.inventory.reserve).toHaveBeenCalledTimes(1);
    expect(h.inventory.deduct).not.toHaveBeenCalled();
    expect(order.status).toBe('PENDING_PAYMENT');
  });

  it('memotong stok saat order CASH dibuat (sudah PAID)', async () => {
    const h = build();

    await h.service.create('actor-1', cashOrder());

    expect(h.inventory.deduct).toHaveBeenCalledTimes(1);
    expect(h.inventory.reserve).not.toHaveBeenCalled();
  });

  it('menulis outbox event order.created dalam transaksi yang sama', async () => {
    const h = build();

    await h.service.create('actor-1', cashOrder());

    expect(h.outbox.enqueue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: 'order.created', aggregateType: 'order' }),
    );
  });

  it('mengembalikan order yang sama untuk client_order_id duplikat (idempoten)', async () => {
    const h = build();
    h.orders.__setStored(makeOrderRow());

    const order = await h.service.create('actor-1', cashOrder());

    expect(h.orders.inserted).toHaveLength(0);
    expect(h.orders.findByClientOrderId).toHaveBeenCalledWith(CLIENT_ORDER_ID);
    expect(order.client_order_id).toBe(CLIENT_ORDER_ID);
  });

  it('menolak produk yang tidak tersedia', async () => {
    const h = build();
    h.products.findByIds.mockResolvedValueOnce([
      {
        id: PRODUCT_ID,
        outletId: OUTLET_ID,
        categoryId: 'cat',
        sku: 'KOPI-001',
        name: 'Kopi Butter',
        description: null,
        basePrice: 18_000,
        imageUrl: null,
        station: 'KOPI',
        isAvailable: false,
        prepTimeMinutes: 3,
        sortOrder: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        categoryName: 'Kopi',
        modifierGroups: [],
      },
    ]);

    await expect(h.service.create('actor-1', cashOrder())).rejects.toBeInstanceOf(AppError);
  });

  it('menambahkan price_delta modifier ke harga item', async () => {
    const h = build();

    await h.service.create(
      'actor-1',
      cashOrder({
        items: [{ product_id: PRODUCT_ID, qty: 1, modifier_option_ids: [OPTION_ID] }],
        cash_received: 30_000,
      } as Partial<CreateOrderInput>),
    );

    // 18.000 + 2.000 modifier = 20.000
    expect(h.orders.inserted[0]).toMatchObject({ subtotal: 20_000 });

    const itemRows = h.orders.insertedItems as { unitPrice: number; subtotal: number }[];
    expect(itemRows[0]).toMatchObject({ unitPrice: 20_000, subtotal: 20_000 });
  });

  it('menolak cash_received kurang dari total', async () => {
    const h = build();
    await expect(
      h.service.create('actor-1', cashOrder({ cash_received: 5_000 })),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('melempar NOT_FOUND untuk order yang tidak ada', async () => {
    const h = build();
    h.orders.__setStored(undefined);
    await expect(h.service.getById('missing', 'actor-1')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});
