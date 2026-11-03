import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gte, lt, sql } from 'drizzle-orm';

import { DRIZZLE, type Database } from '../../database/drizzle.service';
import { order, orderItem, payment } from '../../database/schema';
import { businessDateRange } from '../../shared/time/business-date';

export type SalesReport = {
  business_date: string;
  total_orders: number;
  gross_sales: number;
  discount_total: number;
  tax_total: number;
  net_sales: number;
  by_channel: { channel: string; orders: number; total: number }[];
  by_payment_method: { method: string; count: number; total: number }[];
};

export type TopProduct = { product_id: string; product_name: string; qty: number; revenue: number };

/**
 * Laporan (PRD FR-ADM-01/06).
 *
 * Semua agregasi memakai `business_date`, bukan tanggal kalender —
 * transaksi jam 01:30 masuk ke hari bisnis kemarin (lihat `shared/time`).
 */
@Injectable()
export class ReportingService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async salesReport(
    outletId: string,
    businessDate: string,
    cutoffHour = 4,
    timeZone = 'Asia/Jakarta',
  ): Promise<SalesReport> {
    const { start, end } = businessDateRange(businessDate, cutoffHour, timeZone);

    const totals = await this.db
      .select({
        totalOrders: sql<number>`count(*)::int`,
        gross: sql<string>`coalesce(sum(${order.subtotal}), 0)`,
        discount: sql<string>`coalesce(sum(${order.discount}), 0)`,
        tax: sql<string>`coalesce(sum(${order.tax}), 0)`,
        net: sql<string>`coalesce(sum(${order.total}), 0)`,
      })
      .from(order)
      .where(
        and(
          eq(order.outletId, outletId),
          gte(order.createdAt, start),
          lt(order.createdAt, end),
          sql`${order.status} NOT IN ('CANCELLED', 'VOID', 'EXPIRED')`,
        ),
      );

    const byChannel = await this.db
      .select({
        channel: order.channel,
        orders: sql<number>`count(*)::int`,
        total: sql<string>`coalesce(sum(${order.total}), 0)`,
      })
      .from(order)
      .where(
        and(
          eq(order.outletId, outletId),
          gte(order.createdAt, start),
          lt(order.createdAt, end),
          sql`${order.status} NOT IN ('CANCELLED', 'VOID', 'EXPIRED')`,
        ),
      )
      .groupBy(order.channel);

    const byPayment = await this.db
      .select({
        method: payment.method,
        count: sql<number>`count(*)::int`,
        total: sql<string>`coalesce(sum(${payment.amount}), 0)`,
      })
      .from(payment)
      .where(
        and(
          eq(payment.outletId, outletId),
          eq(payment.status, 'PAID'),
          gte(payment.createdAt, start),
          lt(payment.createdAt, end),
        ),
      )
      .groupBy(payment.method);

    const row = totals[0];

    return {
      business_date: businessDate,
      total_orders: row?.totalOrders ?? 0,
      gross_sales: Number(row?.gross ?? 0),
      discount_total: Number(row?.discount ?? 0),
      tax_total: Number(row?.tax ?? 0),
      net_sales: Number(row?.net ?? 0),
      by_channel: byChannel.map((entry) => ({
        channel: entry.channel,
        orders: entry.orders,
        total: Number(entry.total),
      })),
      by_payment_method: byPayment.map((entry) => ({
        method: entry.method,
        count: entry.count,
        total: Number(entry.total),
      })),
    };
  }

  async topProducts(
    outletId: string,
    businessDate: string,
    cutoffHour = 4,
    limit = 10,
    timeZone = 'Asia/Jakarta',
  ): Promise<TopProduct[]> {
    const { start, end } = businessDateRange(businessDate, cutoffHour, timeZone);

    const rows = await this.db
      .select({
        productId: orderItem.productId,
        productName: orderItem.productName,
        qty: sql<number>`sum(${orderItem.qty})::int`,
        revenue: sql<string>`coalesce(sum(${orderItem.subtotal}), 0)`,
      })
      .from(orderItem)
      .innerJoin(order, eq(order.id, orderItem.orderId))
      .where(
        and(
          eq(orderItem.outletId, outletId),
          gte(order.createdAt, start),
          lt(order.createdAt, end),
          sql`${order.status} NOT IN ('CANCELLED', 'VOID', 'EXPIRED')`,
        ),
      )
      .groupBy(orderItem.productId, orderItem.productName)
      .orderBy(sql`sum(${orderItem.qty}) DESC`)
      .limit(Math.min(Math.max(limit, 1), 100));

    return rows.map((row) => ({
      product_id: row.productId,
      product_name: row.productName,
      qty: row.qty,
      revenue: Number(row.revenue),
    }));
  }

  /** Ekspor CSV sederhana (FR-ADM-06) — dipakai admin untuk unduh laporan. */
  async exportSalesCsv(
    outletId: string,
    businessDate: string,
    cutoffHour = 4,
    timeZone = 'Asia/Jakarta',
  ): Promise<string> {
    const report = await this.salesReport(outletId, businessDate, cutoffHour, timeZone);
    const lines = [
      'business_date,total_orders,gross_sales,discount_total,tax_total,net_sales',
      [
        report.business_date,
        report.total_orders,
        report.gross_sales,
        report.discount_total,
        report.tax_total,
        report.net_sales,
      ].join(','),
    ];
    return lines.join('\n');
  }
}
