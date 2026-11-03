import { InventoryService } from './inventory.service';

const OUTLET_ID = '11111111-1111-4111-8111-111111111111';
const ORDER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PRODUCT_ID = '22222222-2222-4222-8222-222222222222';
const INGREDIENT_ID = '33333333-3333-4333-8333-333333333333';

function build() {
  const repository = {
    findRecipeByProductId: jest.fn(async (): Promise<{
      recipeId: string;
      yieldQty: number;
      lines: {
        ingredientId: string;
        ingredientName: string;
        unit: string;
        qtyPerUnit: number;
        costPerUnit: number;
      }[];
    } | undefined> => ({
      recipeId: 'recipe-1',
      yieldQty: 1,
      lines: [
        {
          ingredientId: INGREDIENT_ID,
          ingredientName: 'Kopi Bubuk',
          unit: 'GRAM',
          qtyPerUnit: 15,
          costPerUnit: 200,
        },
      ],
    })),
    getStock: jest.fn(async () => 1_000),
    upsertStock: jest.fn(async () => 985),
    recordMovement: jest.fn(async () => undefined),
    upsertReservation: jest.fn(async () => undefined),
    releaseReservations: jest.fn(async () => undefined),
    listLowStock: jest.fn(async () => []),
    listIngredientsWithStock: jest.fn(async () => []),
  };

  const service = new InventoryService(repository as never);
  return { service, repository };
}

const tx = {} as never;

describe('InventoryService', () => {
  it('reserve mencatat reservasi per bahan sesuai BOM', async () => {
    const h = build();

    const result = await h.service.reserve(tx, ORDER_ID, OUTLET_ID, [
      { productId: PRODUCT_ID, qty: 2 },
    ]);

    expect(result.reserved).toBe(true);
    expect(h.repository.upsertReservation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ orderId: ORDER_ID, ingredientId: INGREDIENT_ID, qty: '30' }),
    );
  });

  it('reserve melaporkan kekurangan tanpa melempar', async () => {
    const h = build();
    h.repository.getStock.mockResolvedValue(5);

    const result = await h.service.reserve(tx, ORDER_ID, OUTLET_ID, [
      { productId: PRODUCT_ID, qty: 1 },
    ]);

    expect(result.reserved).toBe(false);
    expect(result.shortages).toHaveLength(1);
    expect(result.shortages[0]).toMatchObject({ required: 15, available: 5 });
  });

  it('deduct mengurangi stok dan menulis stock_movement append-only', async () => {
    const h = build();

    const lines = await h.service.deduct(
      tx,
      ORDER_ID,
      OUTLET_ID,
      [{ productId: PRODUCT_ID, qty: 1 }],
      'actor-1',
    );

    expect(h.repository.upsertStock).toHaveBeenCalledWith(
      expect.anything(),
      OUTLET_ID,
      INGREDIENT_ID,
      -15,
    );
    expect(h.repository.recordMovement).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: 'SALE', qtyDelta: '-15', orderId: ORDER_ID }),
    );
    expect(lines[0]).toMatchObject({ qty: 15, qtyAfter: 985 });
  });

  it('deduct tetap berjalan saat stok menjadi negatif (tidak memblokir transaksi)', async () => {
    const h = build();
    h.repository.upsertStock.mockResolvedValue(-5);

    const lines = await h.service.deduct(tx, ORDER_ID, OUTLET_ID, [
      { productId: PRODUCT_ID, qty: 1 },
    ]);

    expect(lines[0]?.qtyAfter).toBe(-5);
    expect(h.repository.recordMovement).toHaveBeenCalled();
  });

  it('produk tanpa resep tidak menghasilkan potongan stok', async () => {
    const h = build();
    h.repository.findRecipeByProductId.mockResolvedValue(undefined);

    const lines = await h.service.deduct(tx, ORDER_ID, OUTLET_ID, [
      { productId: PRODUCT_ID, qty: 1 },
    ]);

    expect(lines).toEqual([]);
    expect(h.repository.upsertStock).not.toHaveBeenCalled();
  });

  it('lowStock meneruskan threshold ke repository', async () => {
    const h = build();
    await h.service.lowStock(OUTLET_ID, 10);
    expect(h.repository.listLowStock).toHaveBeenCalledWith(OUTLET_ID, 10);
  });

  it('restore mengembalikan stok dengan movement REFUND_RESTORE', async () => {
    const h = build();
    await h.service.restore(tx, ORDER_ID, OUTLET_ID, [{ productId: PRODUCT_ID, qty: 1 }]);
    expect(h.repository.recordMovement).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ type: 'REFUND_RESTORE', qtyDelta: '15' }),
    );
  });
});
