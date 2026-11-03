import { createHash } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';
import {
  type CreateOrderInput,
  type SyncCommand,
  type SyncCommandResult,
  type SyncPullQuery,
  type SyncPullResponse,
  type SyncPushRequest,
  type SyncPushResponse,
  type SyncWarning,
} from '@sarko/contracts';
import { AppError, isAppError } from '../../shared/errors/app-error';
import { InventoryService } from '../inventory/inventory.service';
import { OrderingService, toOrderContract } from '../ordering/ordering.service';
import { OrderRepository } from '../ordering/repositories/order.repository';
import { SyncRepository } from './repositories/sync.repository';

export type SyncContext = {
  outletId: string;
  deviceId: string;
  actorId: string;
};

const PULL_PAGE_SIZE = 100;

/**
 * Sinkronisasi perangkat → cloud (PRD §7.12, §10.1.3).
 *
 * Kontrak perilaku:
 * - Command duplikat (command_id sudah ada) → `DUPLICATE` dengan response
 *   TERSIMPAN, tanpa efek samping apa pun.
 * - Error 400/422 → `REJECTED` + kode, tidak menggagalkan seluruh batch.
 * - Selisih total client vs server → `TOTAL_MISMATCH` sebagai warning,
 *   BUKAN penolakan: data device tetap diterima, selisih tercatat.
 */
@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly sync: SyncRepository,
    private readonly orders: OrderRepository,
    private readonly ordering: OrderingService,
    private readonly inventory: InventoryService,
  ) {}

  async push(dto: SyncPushRequest, context?: Partial<SyncContext>): Promise<SyncPushResponse> {
    const results: SyncCommandResult[] = [];

    for (const command of dto.commands) {
      results.push(await this.pushOne(command, dto, context));
    }

    return { server_time: new Date().toISOString(), results };
  }

  private async pushOne(
    command: SyncCommand,
    dto: SyncPushRequest,
    context?: Partial<SyncContext>,
  ): Promise<SyncCommandResult> {
    const existing = await this.sync.findCommand(command.command_id);
    if (existing !== undefined) {
      return {
        command_id: command.command_id,
        status: 'DUPLICATE',
        aggregate_id: existing.aggregateId ?? command.aggregate_id,
        warnings: [],
        ...(existing.responseBody === null || existing.responseBody === undefined
          ? {}
          : { message: 'Command sudah pernah diproses' }),
      };
    }

    const warnings: SyncWarning[] = [];

    try {
      const outcome = await this.dispatch(command, dto, context, warnings);

      await this.sync.insertCommand({
        outletId: context?.outletId ?? dto.outlet_id,
        deviceId: dto.device_id,
        commandId: command.command_id,
        commandType: command.type,
        aggregateId: outcome.aggregateId,
        payloadHash: hashPayload(command.payload),
        result: outcome.status,
        httpStatus: 200,
        responseBody: { status: outcome.status, aggregate_id: outcome.aggregateId },
      });

      return {
        command_id: command.command_id,
        status: outcome.status,
        aggregate_id: outcome.aggregateId,
        warnings,
      };
    } catch (error) {
      if (isAppError(error) && (error.status === 400 || error.status === 422 || error.status === 409)) {
        await this.sync.insertCommand({
          outletId: context?.outletId ?? dto.outlet_id,
          deviceId: dto.device_id,
          commandId: command.command_id,
          commandType: command.type,
          aggregateId: command.aggregate_id,
          payloadHash: hashPayload(command.payload),
          result: 'REJECTED',
          httpStatus: error.status,
          responseBody: { code: error.code, message: error.detail },
        });

        return {
          command_id: command.command_id,
          status: 'REJECTED',
          aggregate_id: command.aggregate_id,
          code: error.code,
          message: error.detail,
          warnings,
        };
      }

      const message = error instanceof Error ? error.message : 'kesalahan tidak dikenal';
      this.logger.error({ err: error, commandId: command.command_id }, 'Command sync gagal permanen');
      return {
        command_id: command.command_id,
        status: 'RETRY',
        aggregate_id: command.aggregate_id,
        message,
        warnings,
      };
    }
  }

  private async dispatch(
    command: SyncCommand,
    dto: SyncPushRequest,
    context: Partial<SyncContext> | undefined,
    warnings: SyncWarning[],
  ): Promise<{ status: 'CREATED' | 'UPDATED'; aggregateId: string }> {
    switch (command.type) {
      case 'CREATE_ORDER': {
        const payload = command.payload as Record<string, unknown>;
        const createInput = toCreateOrderInput(command, payload);
        const order = await this.ordering.create(context?.actorId ?? `device:${dto.device_id}`, createInput, {
          outletId: context?.outletId ?? dto.outlet_id,
          deviceId: dto.device_id,
        });

        const clientTotal = payload.total;
        if (typeof clientTotal === 'number' && clientTotal !== order.total) {
          warnings.push({
            code: 'TOTAL_MISMATCH',
            message: `Total dari device ${clientTotal} berbeda dengan total server ${order.total}`,
            client_total: clientTotal,
            server_total: order.total,
          });

          await this.sync.recordConflict({
            outletId: context?.outletId ?? dto.outlet_id,
            deviceId: dto.device_id,
            orderId: order.id,
            type: 'TOTAL_MISMATCH',
            deviceValue: { total: clientTotal },
            cloudValue: { total: order.total },
          });
        }

        return { status: 'CREATED', aggregateId: order.id };
      }

      case 'UPDATE_ITEM_STATUS':
      case 'HOLD_ITEM':
      case 'RESUME_ITEM': {
        const payload = command.payload as Record<string, unknown>;
        const status =
          command.type === 'HOLD_ITEM'
            ? 'HOLD'
            : command.type === 'RESUME_ITEM'
              ? 'PENDING'
              : ((payload.status as string | undefined) ?? 'DONE');

        await this.ordering.updateItemStatus(
          command.aggregate_id,
          String(payload.item_id ?? command.aggregate_id),
          status as 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'HOLD',
          context?.actorId ?? `device:${dto.device_id}`,
        );
        return { status: 'UPDATED', aggregateId: command.aggregate_id };
      }

      case 'UPDATE_PRODUCT': {
        const payload = command.payload as Record<string, unknown>;
        const isAvailable = payload.is_available;
        if (typeof isAvailable !== 'boolean') {
          throw AppError.validation('payload.is_available wajib boolean', [
            { field: 'is_available', message: 'harus boolean' },
          ]);
        }
        await this.sync.setProductAvailability(
          context?.outletId ?? dto.outlet_id,
          command.aggregate_id,
          isAvailable,
        );
        return { status: 'UPDATED', aggregateId: command.aggregate_id };
      }

      case 'OPEN_SHIFT':
      case 'CLOSE_SHIFT':
      case 'CASH_DROP':
        // Shift ditangani modul payment/shift; di sini hanya dicatat agar
        // urutan command tetap terjaga dan tidak ada yang hilang.
        return { status: 'UPDATED', aggregateId: command.aggregate_id };

      default:
        return { status: 'UPDATED', aggregateId: command.aggregate_id };
    }
  }

  async pull(query: SyncPullQuery, deviceTime?: Date): Promise<SyncPullResponse> {
    const since = new Date(query.since);
    if (Number.isNaN(since.getTime())) {
      throw AppError.validation('since harus ISO-8601 yang valid');
    }

    const events = await this.sync.listEventsSince(query.outlet_id, since, PULL_PAGE_SIZE + 1);
    const hasMore = events.length > PULL_PAGE_SIZE;
    const page = hasMore ? events.slice(0, PULL_PAGE_SIZE) : events;
    const lastEvent = page.at(-1);

    const products = await this.sync.listProducts(query.outlet_id);
    const taxConfig = await this.sync.listTaxConfig(query.outlet_id);
    const orders = await this.sync.listOtherChannelOrders(query.outlet_id, since, PULL_PAGE_SIZE);

    const serverTime = new Date();

    return {
      server_time: serverTime.toISOString(),
      next_event_id: lastEvent?.id ?? query.since,
      has_more: hasMore,
      menu_version: await this.sync.currentMenuVersion(),
      clock_skew_ms: deviceTime === undefined ? 0 : serverTime.getTime() - deviceTime.getTime(),
      changes: {
        products: products.map((row) => ({
          id: row.id,
          outlet_id: row.outletId,
          category_id: row.categoryId,
          sku: row.sku,
          name: row.name,
          description: row.description,
          base_price: row.basePrice,
          image_url: row.imageUrl,
          station: row.station as 'KOPI' | 'MAKANAN',
          is_available: row.isAvailable,
          modifier_groups: [],
          prep_time_minutes: row.prepTimeMinutes,
          sort_order: row.sortOrder,
        })),
        availability: products.map((row) => ({
          product_id: row.id,
          is_available: row.isAvailable,
        })),
        promotion: [],
        tax_config: taxConfig.map((row) => ({
          id: row.id,
          name: row.name,
          rate_bps: row.rateBps,
        })),
        orders: (
          await Promise.all(orders.map((row) => this.orders.findById(row.id)))
        )
          .filter((row): row is NonNullable<typeof row> => row !== undefined)
          .map((row) => toOrderContract(row)),
      },
    };
  }

  async health(deviceId: string): Promise<{
    queue_depth: number;
    failed_permanent: number;
    last_push_at: string | null;
    last_pull_at: string | null;
    menu_version: string;
    clock_skew_ms: number;
  }> {
    const stats = await this.sync.deviceStats(deviceId);
    return {
      queue_depth: stats.queueDepth,
      failed_permanent: stats.failedPermanent,
      last_push_at: stats.lastPushAt?.toISOString() ?? null,
      last_pull_at: stats.lastPullAt?.toISOString() ?? null,
      menu_version: stats.menuVersion,
      clock_skew_ms: 0,
    };
  }

  async recordHeartbeat(deviceId: string, outletId: string, appVersion: string): Promise<void> {
    await this.sync.recordHeartbeat(outletId, deviceId, appVersion);
  }
}

function toCreateOrderInput(command: SyncCommand, payload: Record<string, unknown>): CreateOrderInput {
  const items = payload.items;
  if (!Array.isArray(items) || items.length === 0) {
    throw AppError.validation('payload.items wajib berisi minimal 1 item', [
      { field: 'items', message: 'minimal 1 item' },
    ]);
  }

  const payment = (payload.payment ?? {}) as Record<string, unknown>;

  return {
    client_order_id: command.command_id,
    order_id: payload.order_id as string | undefined,
    order_no: payload.order_no as string | undefined,
    channel: (payload.channel as CreateOrderInput['channel']) ?? 'POS',
    fulfillment: (payload.fulfillment as CreateOrderInput['fulfillment']) ?? 'DINE_IN',
    table_id: payload.table_id as string | undefined,
    table_label: payload.table_label as string | undefined,
    items: items.map((raw) => {
      const item = raw as Record<string, unknown>;
      return {
        product_id: String(item.product_id),
        qty: Number(item.qty ?? 1),
        modifier_option_ids: Array.isArray(item.modifier_option_ids)
          ? (item.modifier_option_ids as string[])
          : [],
        notes: item.notes as string | undefined,
      };
    }),
    payment_method: (payment.method as CreateOrderInput['payment_method']) ?? 'CASH',
    cash_received: payment.cash_received as number | undefined,
    discount_code: payload.discount_code as string | undefined,
    notes: payload.notes as string | undefined,
    created_at_local: payload.created_at as string | undefined,
    business_date: payload.business_date as string | undefined,
    clock_skew_ms: payload.clock_skew_ms as number | undefined,
  } as CreateOrderInput;
}

function hashPayload(payload: Record<string, unknown>): string {
  const canonical = JSON.stringify(payload, Object.keys(payload).sort());
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}
