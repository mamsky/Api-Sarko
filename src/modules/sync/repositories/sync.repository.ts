import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gt, isNull, ne, sql } from 'drizzle-orm';

import { DRIZZLE, type Database } from '../../../database/drizzle.service';
import {
  device,
  deviceHeartbeat,
  order,
  outboxEvent,
  product,
  syncCommandLog,
  syncConflict,
  taxConfig,
} from '../../../database/schema';

export type SyncCommandRow = typeof syncCommandLog.$inferSelect;

export type SyncCommandInsert = {
  outletId: string;
  deviceId: string;
  commandId: string;
  commandType: string;
  aggregateId: string;
  payloadHash: string;
  result: string;
  httpStatus: number;
  responseBody: Record<string, unknown> | null;
};

@Injectable()
export class SyncRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async findCommand(commandId: string): Promise<SyncCommandRow | undefined> {
    const rows = await this.db
      .select()
      .from(syncCommandLog)
      .where(eq(syncCommandLog.commandId, commandId))
      .limit(1);
    return rows[0];
  }

  async insertCommand(values: SyncCommandInsert): Promise<void> {
    await this.db
      .insert(syncCommandLog)
      .values({
        outletId: values.outletId,
        deviceId: values.deviceId,
        commandId: values.commandId,
        commandType: values.commandType,
        aggregateId: values.aggregateId,
        payloadHash: values.payloadHash,
        result: values.result,
        httpStatus: values.httpStatus,
        responseBody: values.responseBody,
        processedAt: new Date(),
      })
      .onConflictDoNothing({ target: syncCommandLog.commandId });
  }

  async listEventsSince(
    outletId: string,
    since: Date,
    limit: number,
  ): Promise<{ id: string; eventType: string; createdAt: Date }[]> {
    return this.db
      .select({
        id: outboxEvent.id,
        eventType: outboxEvent.eventType,
        createdAt: outboxEvent.createdAt,
      })
      .from(outboxEvent)
      .where(and(eq(outboxEvent.outletId, outletId), gt(outboxEvent.createdAt, since)))
      .orderBy(outboxEvent.createdAt)
      .limit(limit);
  }

  async listProducts(outletId: string): Promise<(typeof product.$inferSelect)[]> {
    return this.db
      .select()
      .from(product)
      .where(and(eq(product.outletId, outletId), isNull(product.deletedAt)));
  }

  async listTaxConfig(outletId: string): Promise<(typeof taxConfig.$inferSelect)[]> {
    return this.db
      .select()
      .from(taxConfig)
      .where(and(eq(taxConfig.outletId, outletId), eq(taxConfig.isActive, 'true')));
  }

  async listOtherChannelOrders(
    outletId: string,
    since: Date,
    limit: number,
  ): Promise<(typeof order.$inferSelect)[]> {
    return this.db
      .select()
      .from(order)
      .where(
        and(
          eq(order.outletId, outletId),
          gt(order.createdAt, since),
          ne(order.channel, 'POS'),
        ),
      )
      .orderBy(desc(order.createdAt))
      .limit(limit);
  }

  async recordConflict(values: {
    outletId: string;
    deviceId: string;
    orderId: string;
    type: string;
    deviceValue: Record<string, unknown>;
    cloudValue: Record<string, unknown>;
  }): Promise<void> {
    await this.db.insert(syncConflict).values({
      outletId: values.outletId,
      deviceId: values.deviceId,
      orderId: values.orderId,
      type: values.type,
      deviceValue: values.deviceValue,
      cloudValue: values.cloudValue,
      resolution: 'PENDING_REVIEW',
    });
  }

  async setProductAvailability(
    outletId: string,
    productId: string,
    isAvailable: boolean,
  ): Promise<void> {
    await this.db
      .update(product)
      .set({ isAvailable, updatedAt: new Date() })
      .where(and(eq(product.id, productId), eq(product.outletId, outletId)));
  }

  async deviceStats(deviceId: string): Promise<{
    queueDepth: number;
    failedPermanent: number;
    lastPushAt: Date | null;
    lastPullAt: Date | null;
    menuVersion: string;
  }> {
    const rows = await this.db
      .select({
        total: sql<number>`count(*)::int`,
        lastPush: sql<Date | null>`max(${syncCommandLog.processedAt})`,
      })
      .from(syncCommandLog)
      .where(eq(syncCommandLog.deviceId, deviceId));

    const lastPush = rows[0]?.lastPush ?? null;

    return {
      queueDepth: 0,
      failedPermanent: 0,
      lastPushAt: lastPush instanceof Date ? lastPush : lastPush === null ? null : new Date(lastPush),
      lastPullAt: null,
      menuVersion: await this.currentMenuVersion(),
    };
  }

  async currentMenuVersion(): Promise<string> {
    const rows = await this.db
      .select({ updated: sql<Date | null>`max(${product.updatedAt})`, count: sql<number>`count(*)::int` })
      .from(product);
    const updated = rows[0]?.updated ?? null;
    const count = rows[0]?.count ?? 0;
    const stamp = updated instanceof Date ? updated.getTime() : updated === null ? 0 : new Date(updated).getTime();
    return `${count}-${stamp}`;
  }

  async recordHeartbeat(outletId: string, deviceKey: string, appVersion: string): Promise<void> {
    const rows = await this.db
      .select({ id: device.id })
      .from(device)
      .where(eq(device.deviceId, deviceKey))
      .limit(1);

    const deviceUuid = rows[0]?.id;
    if (deviceUuid === undefined) {
      return;
    }

    await this.db
      .update(device)
      .set({ lastSeenAt: new Date(), appVersion, updatedAt: new Date() })
      .where(eq(device.id, deviceUuid));

    await this.db.insert(deviceHeartbeat).values({
      outletId,
      deviceId: deviceUuid,
      appVersion,
    });
  }
}
