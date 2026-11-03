import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, gte, inArray, lt, lte, or, sql, type SQL } from 'drizzle-orm';

import { DRIZZLE, type Database } from '../../../database/drizzle.service';
import { order, orderItem, orderItemModifier, orderStatusHistory } from '../../../database/schema';
import type { OrderStatus } from '@sarko/contracts';

export type OrderRow = typeof order.$inferSelect;
export type OrderItemRow = typeof orderItem.$inferSelect;
export type OrderItemModifierRow = typeof orderItemModifier.$inferSelect;

export type OrderWithItems = OrderRow & {
  items: (OrderItemRow & { modifiers: OrderItemModifierRow[] })[];
};

export type ListOrdersFilter = {
  outletId?: string;
  status?: OrderStatus[];
  channel?: string;
  businessDate?: string;
  from?: Date;
  to?: Date;
  cursor?: { createdAt: Date; id: string };
  limit: number;
};

@Injectable()
export class OrderRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async transaction<T>(work: (tx: Database) => Promise<T>): Promise<T> {
    return this.db.transaction(async (tx) => work(tx as unknown as Database));
  }

  async findById(id: string): Promise<OrderWithItems | undefined> {
    const rows = await this.db
      .select()
      .from(order)
      .leftJoin(orderItem, eq(orderItem.orderId, order.id))
      .leftJoin(orderItemModifier, eq(orderItemModifier.orderItemId, orderItem.id))
      .where(eq(order.id, id))
      .orderBy(asc(orderItem.createdAt), asc(orderItemModifier.createdAt));

    if (rows.length === 0) {
      return undefined;
    }

    const head = rows[0];
    if (head === undefined) {
      return undefined;
    }

    const base = head.order;
    const items = new Map<string, OrderItemRow & { modifiers: OrderItemModifierRow[] }>();

    for (const row of rows) {
      const item = row.order_item;
      if (item === null) {
        continue;
      }
      let entry = items.get(item.id);
      if (entry === undefined) {
        entry = { ...item, modifiers: [] };
        items.set(item.id, entry);
      }
      const modifier = row.order_item_modifier;
      if (modifier !== null) {
        entry.modifiers.push(modifier);
      }
    }

    return { ...base, items: [...items.values()] };
  }

  async findByClientOrderId(clientOrderId: string): Promise<OrderWithItems | undefined> {
    const rows = await this.db
      .select({ id: order.id })
      .from(order)
      .where(eq(order.clientOrderId, clientOrderId))
      .limit(1);

    const id = rows[0]?.id;
    return id === undefined ? undefined : this.findById(id);
  }

  async findByOrderNo(outletId: string, orderNo: string): Promise<OrderWithItems | undefined> {
    const rows = await this.db
      .select({ id: order.id })
      .from(order)
      .where(and(eq(order.outletId, outletId), eq(order.orderNo, orderNo)))
      .limit(1);

    const id = rows[0]?.id;
    return id === undefined ? undefined : this.findById(id);
  }

  async list(filter: ListOrdersFilter): Promise<OrderWithItems[]> {
    const conditions: SQL[] = [];
    if (filter.outletId !== undefined) {
      conditions.push(eq(order.outletId, filter.outletId));
    }
    if (filter.status !== undefined && filter.status.length > 0) {
      conditions.push(inArray(order.status, filter.status));
    }
    if (filter.channel !== undefined) {
      conditions.push(eq(order.channel, filter.channel));
    }
    if (filter.businessDate !== undefined) {
      conditions.push(eq(order.businessDate, filter.businessDate));
    }
    if (filter.from !== undefined) {
      conditions.push(gte(order.createdAt, filter.from));
    }
    if (filter.to !== undefined) {
      conditions.push(lte(order.createdAt, filter.to));
    }
    if (filter.cursor !== undefined) {
      // Keyset: (created_at, id) < (cursor.createdAt, cursor.id) dengan DESC.
      conditions.push(
        or(
          lt(order.createdAt, filter.cursor.createdAt),
          and(eq(order.createdAt, filter.cursor.createdAt), lt(order.id, filter.cursor.id)),
        ) as SQL,
      );
    }

    const rows = await this.db
      .select()
      .from(order)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(order.createdAt), desc(order.id))
      .limit(filter.limit + 1);

    if (rows.length === 0) {
      return [];
    }

    const ids = rows.map((row) => row.id);
    const itemRows = await this.db
      .select()
      .from(orderItem)
      .where(inArray(orderItem.orderId, ids));

    const modifierRows =
      itemRows.length === 0
        ? []
        : await this.db
            .select()
            .from(orderItemModifier)
            .where(
              inArray(
                orderItemModifier.orderItemId,
                itemRows.map((item) => item.id),
              ),
            );

    const modifiersByItem = new Map<string, OrderItemModifierRow[]>();
    for (const modifier of modifierRows) {
      const list = modifiersByItem.get(modifier.orderItemId) ?? [];
      list.push(modifier);
      modifiersByItem.set(modifier.orderItemId, list);
    }

    const itemsByOrder = new Map<string, (OrderItemRow & { modifiers: OrderItemModifierRow[] })[]>();
    for (const item of itemRows) {
      const list = itemsByOrder.get(item.orderId) ?? [];
      list.push({ ...item, modifiers: modifiersByItem.get(item.id) ?? [] });
      itemsByOrder.set(item.orderId, list);
    }

    return rows.map((row) => ({ ...row, items: itemsByOrder.get(row.id) ?? [] }));
  }

  async insert(tx: Database, values: typeof order.$inferInsert): Promise<OrderRow> {
    const rows = await tx.insert(order).values(values).returning();
    const row = rows[0];
    if (row === undefined) {
      throw new Error('Insert order tidak mengembalikan baris');
    }
    return row;
  }

  async insertItems(tx: Database, values: (typeof orderItem.$inferInsert)[]): Promise<OrderItemRow[]> {
    if (values.length === 0) {
      return [];
    }
    return tx.insert(orderItem).values(values).returning();
  }

  async insertItemModifiers(
    tx: Database,
    values: (typeof orderItemModifier.$inferInsert)[],
  ): Promise<void> {
    if (values.length === 0) {
      return;
    }
    await tx.insert(orderItemModifier).values(values);
  }

  async updateStatus(
    tx: Database,
    id: string,
    to: OrderStatus,
    extra: Partial<typeof order.$inferInsert> = {},
  ): Promise<OrderRow | undefined> {
    const rows = await tx
      .update(order)
      .set({ status: to, updatedAt: new Date(), ...extra })
      .where(eq(order.id, id))
      .returning();
    return rows[0];
  }

  async recordStatusHistory(
    tx: Database,
    values: typeof orderStatusHistory.$inferInsert,
  ): Promise<void> {
    await tx.insert(orderStatusHistory).values(values);
  }

  async findStatusHistory(orderId: string): Promise<(typeof orderStatusHistory.$inferSelect)[]> {
    return this.db
      .select()
      .from(orderStatusHistory)
      .where(eq(orderStatusHistory.orderId, orderId))
      .orderBy(asc(orderStatusHistory.createdAt));
  }

  async updateItemStatus(
    tx: Database,
    orderItemId: string,
    status: string,
  ): Promise<OrderItemRow | undefined> {
    const rows = await tx
      .update(orderItem)
      .set({ status, updatedAt: new Date() })
      .where(eq(orderItem.id, orderItemId))
      .returning();
    return rows[0];
  }

  async countItemsByStatus(orderId: string): Promise<{ total: number; done: number }> {
    const rows = await this.db
      .select({
        total: sql<number>`count(*)::int`,
        done: sql<number>`count(*) FILTER (WHERE ${orderItem.status} = 'DONE')::int`,
      })
      .from(orderItem)
      .where(eq(orderItem.orderId, orderId));

    return rows[0] ?? { total: 0, done: 0 };
  }
}
