import { Injectable, Logger } from '@nestjs/common';
import {
  type CreateOrderInput,
  type Order,
  type OrderItem,
  type OrderSummary,
  type OrderStatus,
  type PaginationQuery,
  uuidSchema,
} from '@sarko/contracts';
import type { Database } from '../../database/drizzle.service';
import { AppError } from '../../shared/errors/app-error';
import { newId } from '../../shared/id/id';
import { add, multiply, percent, subtract } from '../../shared/money/money';
import { OutboxService } from '../../shared/outbox/outbox.service';
import { businessDate } from '../../shared/time/business-date';
import { InventoryService } from '../inventory/inventory.service';
import { ProductRepository } from '../catalog/repositories/product.repository';
import { OrderStateMachine } from './order-state.machine';
import { formatOrderNo, OrderNumberService } from './order-number.service';
import type { OrderWithItems } from './repositories/order.repository';
import { OrderRepository } from './repositories/order.repository';
import { OutletTaxRepository } from './repositories/outlet-tax.repository';

export type TransitionOptions = {
  reason?: string;
  deviceId?: string;
  actorId?: string;
};

export type ListOrdersQuery = PaginationQuery & {
  outlet_id?: string;
  status?: string;
  channel?: string;
  business_date?: string;
  from?: string;
  to?: string;
};

export type CreateOrderContext = {
  outletId: string;
  actorId: string;
  deviceId?: string | null;
  shiftId?: string | null;
  outletCode: string;
  deviceCode: string;
};

/**
 * Logika bisnis pesanan (PRD §7.4, §9.2b).
 *
 * Prinsip yang dipegang di sini:
 * - Harga SELALU dihitung ulang dari DB; `base_price` + `price_delta` modifier.
 * - Pajak = persentase (bps) dari (subtotal - diskon), bukan nominal flat.
 * - Order + item + modifier + outbox ditulis dalam SATU transaksi.
 */
@Injectable()
export class OrderingService {
  private readonly logger = new Logger(OrderingService.name);

  constructor(
    private readonly orders: OrderRepository,
    private readonly products: ProductRepository,
    private readonly outlets: OutletTaxRepository,
    private readonly orderNumbers: OrderNumberService,
    private readonly inventory: InventoryService,
    private readonly outbox: OutboxService,
  ) {}

  async create(actorId: string, dto: CreateOrderInput, context?: Partial<CreateOrderContext>): Promise<Order> {
    const outletId = context?.outletId ?? (await this.resolveDefaultOutletId());
    const outlet = await this.outlets.findById(outletId);
    if (outlet === undefined) {
      throw AppError.notFound('Outlet');
    }

    const existing = await this.orders.findByClientOrderId(dto.client_order_id);
    if (existing !== undefined) {
      return toOrderContract(existing);
    }

    const taxConfig = await this.outlets.findActiveTaxConfig(outletId);
    const taxRateBps = taxConfig?.rateBps ?? 0;

    const priced = await this.priceItems(outletId, dto);
    const subtotal = priced.reduce((total, line) => add(total, line.subtotal), 0);
    const discount = await this.resolveDiscount(outletId, dto, subtotal);
    const taxable = subtract(subtotal, discount);
    const tax = percent(taxable, taxRateBps);
    const total = add(taxable, tax);

    const initialStatus = OrderStateMachine.initialStatus(dto.payment_method);
    const orderId = resolveOrderId(dto.order_id);
    const now = new Date();
    const bDate = dto.business_date ?? businessDate(now, outlet.cutoffHour, outlet.timezone);

    const cashReceived = dto.cash_received ?? null;
    if (dto.payment_method === 'CASH' && cashReceived !== null && cashReceived < total) {
      throw AppError.validation('Uang tunai yang diterima kurang dari total order', [
        { field: 'cash_received', message: `Minimal ${total}` },
      ]);
    }

    if (dto.order_no !== undefined) {
      const clash = await this.orders.findByOrderNo(outletId, dto.order_no);
      if (clash !== undefined && clash.id !== orderId) {
        throw AppError.conflict(
          `Nomor order ${dto.order_no} sudah dipakai order lain (${clash.id}) di outlet ini`,
        );
      }
    }

    const created = await this.transaction(async (tx) => {
      const orderNo =
        dto.order_no ??
        (await this.allocateOrderNo(tx, {
          outletId,
          outletCode: context?.outletCode ?? outlet.code,
          deviceCode: context?.deviceCode ?? 'P1',
          deviceId: context?.deviceId ?? null,
          shiftId: context?.shiftId ?? null,
        }));

      const orderRow = await this.orders.insert(tx, {
        id: orderId,
        outletId,
        orderNo,
        clientOrderId: dto.client_order_id,
        shiftId: context?.shiftId ?? null,
        deviceId: context?.deviceId ?? null,
        userId: actorId.length > 0 ? actorId : null,
        tableId: dto.table_id ?? null,
        tableLabel: dto.table_label ?? null,
        channel: dto.channel,
        fulfillment: dto.fulfillment,
        status: initialStatus,
        paymentMethod: dto.payment_method,
        subtotal,
        discount,
        tax,
        total,
        taxRateBps,
        cashReceived,
        changeDue: cashReceived === null ? null : subtract(cashReceived, total),
        discountCode: dto.discount_code ?? null,
        notes: dto.notes ?? null,
        businessDate: bDate,
        clockSkewMs: dto.clock_skew_ms ?? null,
        paidAt: initialStatus === 'PAID' ? now : null,
        syncedAt: now,
      });

      const itemRows = await this.orders.insertItems(
        tx,
        priced.map((line) => ({
          id: line.id,
          outletId,
          orderId: orderRow.id,
          productId: line.productId,
          productName: line.productName,
          sku: line.sku,
          qty: line.qty,
          unitPrice: line.unitPrice,
          modifierTotal: line.modifierTotal,
          subtotal: line.subtotal,
          station: line.station,
          status: 'PENDING',
          notes: line.notes ?? null,
        })),
      );

      await this.orders.insertItemModifiers(
        tx,
        priced.flatMap((line) =>
          line.modifiers.map((modifier) => ({
            id: newId(),
            outletId,
            orderItemId: line.id,
            modifierOptionId: modifier.modifier_option_id,
            name: modifier.name,
            priceDelta: modifier.price_delta,
          })),
        ),
      );

      await this.orders.recordStatusHistory(tx, {
        outletId,
        orderId: orderRow.id,
        fromStatus: null,
        toStatus: initialStatus,
        actorId: actorId.length > 0 ? actorId : null,
        deviceId: context?.deviceId ?? null,
        reason: 'order dibuat',
      });

      if (initialStatus === 'PENDING_PAYMENT') {
        await this.inventory.reserve(
          tx,
          orderRow.id,
          outletId,
          priced.map((line) => ({ productId: line.productId, qty: line.qty })),
        );
      }

      if (initialStatus === 'PAID') {
        await this.inventory.deduct(
          tx,
          orderRow.id,
          outletId,
          priced.map((line) => ({ productId: line.productId, qty: line.qty })),
          actorId,
        );
      }

      await this.outbox.enqueue(tx, {
        aggregateType: 'order',
        aggregateId: orderRow.id,
        eventType: 'order.created',
        outletId,
        payload: {
          order_id: orderRow.id,
          order_no: orderRow.orderNo,
          status: initialStatus,
          total,
          channel: dto.channel,
          business_date: bDate,
        },
      });

      if (initialStatus === 'PAID') {
        await this.outbox.enqueue(tx, {
          aggregateType: 'order',
          aggregateId: orderRow.id,
          eventType: 'order.paid',
          outletId,
          payload: { order_id: orderRow.id, order_no: orderRow.orderNo, total, method: dto.payment_method },
        });
      }

      void itemRows;
      return orderRow.id;
    });

    const saved = await this.orders.findById(created);
    if (saved === undefined) {
      throw AppError.internal('Order gagal dibaca setelah dibuat');
    }
    return toOrderContract(saved);
  }

  /** Satu-satunya jalur perubahan status (PRD §7.4.2). */
  async transition(
    orderId: string,
    to: OrderStatus,
    actorId: string,
    options: TransitionOptions = {},
  ): Promise<Order> {
    const current = await this.orders.findById(orderId);
    if (current === undefined) {
      throw AppError.notFound('Order');
    }

    OrderStateMachine.assertTransition(current.status as OrderStatus, to);

    if (to === 'VOID' && !OrderStateMachine.requiresPayment(current.status as OrderStatus)) {
      throw AppError.conflict('Void hanya untuk order yang sudah dibayar');
    }

    await this.transaction(async (tx) => {
      const extra: Record<string, unknown> = {};
      if (to === 'PAID') {
        extra.paidAt = new Date();
      }
      if (to === 'COMPLETED') {
        extra.completedAt = new Date();
      }
      if (to === 'CANCELLED' || to === 'VOID' || to === 'EXPIRED') {
        extra.cancelledAt = new Date();
      }

      await this.orders.updateStatus(tx, orderId, to, extra);
      await this.orders.recordStatusHistory(tx, {
        outletId: current.outletId,
        orderId,
        fromStatus: current.status,
        toStatus: to,
        actorId: actorId.length > 0 ? actorId : null,
        deviceId: options.deviceId ?? null,
        reason: options.reason ?? null,
      });

      if (to === 'PAID' && current.status === 'PENDING_PAYMENT') {
        await this.inventory.deduct(
          tx,
          orderId,
          current.outletId,
          current.items.map((item) => ({ productId: item.productId, qty: item.qty })),
          actorId,
        );
      }

      await this.outbox.enqueue(tx, {
        aggregateType: 'order',
        aggregateId: orderId,
        eventType: 'order.status_changed',
        outletId: current.outletId,
        payload: {
          order_id: orderId,
          from: current.status,
          to,
          actor_id: actorId,
          reason: options.reason ?? null,
        },
      });

      if (to === 'PAID') {
        await this.outbox.enqueue(tx, {
          aggregateType: 'order',
          aggregateId: orderId,
          eventType: 'order.paid',
          outletId: current.outletId,
          payload: { order_id: orderId, order_no: current.orderNo, total: current.total },
        });
      }
    });

    const updated = await this.orders.findById(orderId);
    if (updated === undefined) {
      throw AppError.internal('Order hilang setelah transisi status');
    }
    return toOrderContract(updated);
  }

  async getById(id: string, actorId: string): Promise<Order> {
    void actorId;
    const row = await this.orders.findById(id);
    if (row === undefined) {
      throw AppError.notFound('Order');
    }
    return toOrderContract(row);
  }

  async list(query: ListOrdersQuery, actorId: string): Promise<{
    data: OrderSummary[];
    next_cursor: string | null;
    has_more: boolean;
  }> {
    void actorId;
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 100);

    const rows = await this.orders.list({
      outletId: query.outlet_id,
      status: query.status === undefined ? undefined : (query.status.split(',') as OrderStatus[]),
      channel: query.channel,
      businessDate: query.business_date,
      from: query.from === undefined ? undefined : new Date(query.from),
      to: query.to === undefined ? undefined : new Date(query.to),
      limit,
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page.at(-1);

    return {
      data: page.map(toOrderSummary),
      next_cursor:
        hasMore && last !== undefined
          ? Buffer.from(`${last.createdAt.toISOString()}|${last.id}`, 'utf8').toString('base64url')
          : null,
      has_more: hasMore,
    };
  }

  async updateItemStatus(
    orderId: string,
    itemId: string,
    status: 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'HOLD',
    actorId: string,
  ): Promise<void> {
    const current = await this.orders.findById(orderId);
    if (current === undefined) {
      throw AppError.notFound('Order');
    }
    if (!current.items.some((item) => item.id === itemId)) {
      throw AppError.notFound('Item order');
    }

    await this.transaction(async (tx) => {
      await this.orders.updateItemStatus(tx, itemId, status);
      await this.outbox.enqueue(tx, {
        aggregateType: 'order',
        aggregateId: orderId,
        eventType: 'order.item_status_changed',
        outletId: current.outletId,
        payload: { order_id: orderId, item_id: itemId, status, actor_id: actorId },
      });
    });

    if (status === 'DONE') {
      const counts = await this.orders.countItemsByStatus(orderId);
      if (counts.total > 0 && counts.done === counts.total) {
        const fresh = await this.orders.findById(orderId);
        if (fresh !== undefined && fresh.status === 'IN_KITCHEN') {
          await this.transition(orderId, 'READY', actorId, { reason: 'semua item selesai' });
        }
      }
    }
  }

  private async priceItems(outletId: string, dto: CreateOrderInput): Promise<PricedLine[]> {
    const productIds = [...new Set(dto.items.map((item) => item.product_id))];
    const products = await this.products.findByIds(outletId, productIds);
    const byId = new Map(products.map((product) => [product.id, product]));

    const missing = productIds.filter((id) => !byId.has(id));
    if (missing.length > 0) {
      throw AppError.validation('Produk tidak ditemukan di outlet ini', [
        { field: 'items', message: `Produk tidak dikenal: ${missing.join(', ')}` },
      ]);
    }

    const optionIds = [...new Set(dto.items.flatMap((item) => item.modifier_option_ids))];
    const options = await this.products.findModifierOptions(optionIds);
    const optionById = new Map(options.map((option) => [option.id, option]));

    const unknownOptions = optionIds.filter((id) => !optionById.has(id));
    if (unknownOptions.length > 0) {
      throw AppError.validation('Modifier tidak dikenal', [
        { field: 'items', message: `Modifier tidak dikenal: ${unknownOptions.join(', ')}` },
      ]);
    }

    return dto.items.map((item) => {
      const product = byId.get(item.product_id);
      if (product === undefined) {
        throw AppError.notFound('Produk');
      }
      if (!product.isAvailable) {
        throw AppError.conflict(`Produk "${product.name}" sedang tidak tersedia`);
      }

      const chosen = item.modifier_option_ids.map((optionId) => {
        const option = optionById.get(optionId);
        if (option === undefined) {
          throw AppError.notFound('Modifier');
        }
        return option;
      });

      const modifierTotal = chosen.reduce((total, option) => add(total, option.priceDelta), 0);
      const unitPrice = add(product.basePrice, modifierTotal);

      return {
        id: newId(),
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        qty: item.qty,
        unitPrice,
        modifierTotal,
        subtotal: multiply(unitPrice, item.qty),
        station: product.station,
        notes: item.notes,
        modifiers: chosen.map((option) => ({
          modifier_option_id: option.id,
          name: option.name,
          price_delta: option.priceDelta,
        })),
      };
    });
  }

  /**
   * Diskon dihitung SERVER dari kode voucher, tidak pernah dari nominal client.
   * Voucher tidak dikenal → ditolak, bukan diabaikan diam-diam.
   */
  private async resolveDiscount(outletId: string, dto: CreateOrderInput, subtotal: number): Promise<number> {
    if (dto.discount_code === undefined || dto.discount_code.length === 0) {
      return 0;
    }

    const promotion = await this.outlets.findActiveVoucher(outletId, dto.discount_code);
    if (promotion === undefined) {
      throw AppError.validation('Kode diskon tidak valid', [
        { field: 'discount_code', message: 'Voucher tidak ditemukan atau sudah tidak berlaku' },
      ]);
    }

    const discount =
      promotion.discountType === 'PERCENT'
        ? percent(subtotal, promotion.discountBps)
        : promotion.discountAmount;

    const capped = promotion.maxDiscount > 0 ? Math.min(discount, promotion.maxDiscount) : discount;
    return Math.min(capped, subtotal);
  }

  private async allocateOrderNo(
    tx: Database,
    input: {
      outletId: string;
      outletCode: string;
      deviceCode: string;
      deviceId: string | null;
      shiftId: string | null;
    },
  ): Promise<string> {
    const prefix = `${input.outletCode}-${input.deviceCode}`;
    const active = await this.orderNumbers.findActiveBlock(tx, input.outletId, prefix);
    const block =
      active === undefined
        ? await this.orderNumbers.allocateBlock(tx, {
            outletId: input.outletId,
            prefix,
            deviceId: input.deviceId,
            shiftId: input.shiftId,
          })
        : active;

    const seq = await this.orderNumbers.consume(tx, block.id);
    return formatOrderNo(input.outletCode, input.deviceCode, seq);
  }

  private async resolveDefaultOutletId(): Promise<string> {
    const outlets = await this.outlets.listActive();
    const first = outlets[0];
    if (first === undefined) {
      throw AppError.notFound('Outlet');
    }
    return first.id;
  }

  private async transaction<T>(work: (tx: Database) => Promise<T>): Promise<T> {
    return this.orders.transaction(work);
  }
}

type PricedLine = {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  qty: number;
  unitPrice: number;
  modifierTotal: number;
  subtotal: number;
  station: string;
  notes?: string;
  modifiers: { modifier_option_id: string; name: string; price_delta: number }[];
};

/**
 * Nomor order FINAL dari device (PRD §7.12.5) — cloud memakainya apa adanya.
 * Bila device tidak mengirimkannya (order online), server membuat UUID baru.
 */
function resolveOrderId(orderId: string | undefined): string {
  if (orderId === undefined) return newId();
  const parsed = uuidSchema.safeParse(orderId);
  if (!parsed.success) {
    throw AppError.validation('order_id harus UUID yang valid', [
      { field: 'order_id', message: 'UUID tidak valid' },
    ]);
  }
  return parsed.data;
}

export function toOrderContract(row: OrderWithItems): Order {
  const items: OrderItem[] = row.items.map((item) => ({
    id: item.id,
    product_id: item.productId,
    product_name: item.productName,
    qty: item.qty,
    unit_price: item.unitPrice,
    subtotal: item.subtotal,
    modifiers: item.modifiers.map((modifier) => ({
      modifier_option_id: modifier.modifierOptionId,
      name: modifier.name,
      price_delta: modifier.priceDelta,
    })),
    notes: item.notes,
    station: item.station as OrderItem['station'],
    status: item.status as OrderItem['status'],
  }));

  return {
    id: row.id,
    order_no: row.orderNo,
    outlet_id: row.outletId,
    channel: row.channel as Order['channel'],
    fulfillment: row.fulfillment as Order['fulfillment'],
    table_label: row.tableLabel,
    status: row.status as OrderStatus,
    items,
    subtotal: row.subtotal,
    discount: row.discount,
    tax: row.tax,
    total: row.total,
    payment_method: row.paymentMethod as Order['payment_method'],
    paid_at: row.paidAt?.toISOString() ?? null,
    created_at: row.createdAt.toISOString(),
    synced_at: row.syncedAt?.toISOString() ?? null,
    business_date: row.businessDate,
    client_order_id: row.clientOrderId,
  };
}

export function toOrderSummary(row: OrderWithItems): OrderSummary {
  return {
    id: row.id,
    order_no: row.orderNo,
    table_label: row.tableLabel,
    channel: row.channel as OrderSummary['channel'],
    fulfillment: row.fulfillment as OrderSummary['fulfillment'],
    status: row.status as OrderStatus,
    total: row.total,
    item_count: row.items.reduce((count, item) => count + item.qty, 0),
    created_at: row.createdAt.toISOString(),
    paid_at: row.paidAt?.toISOString() ?? null,
  };
}
