import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';

import { DRIZZLE, type Database } from '../../database/drizzle.service';
import { notificationLog } from '../../database/schema';

export type NotificationChannel = 'PUSH' | 'WHATSAPP' | 'EMAIL' | 'SMS' | 'IN_APP';

export type NotificationInput = {
  outletId?: string | null;
  channel: NotificationChannel;
  template: string;
  recipient: string;
  payload: Record<string, unknown>;
};

/**
 * Notifikasi (PRD FR-NOT-01).
 *
 * Setiap pengiriman dicatat di `notification_log` dengan status akhir.
 * Transport (FCM/WA/email) di-inject lewat `NotificationTransport` agar
 * unit test tidak butuh jaringan; default mencatat QUEUED.
 */
export interface NotificationTransport {
  send(input: NotificationInput): Promise<{ ok: boolean; error?: string }>;
}

export const NOTIFICATION_TRANSPORT = Symbol('NOTIFICATION_TRANSPORT');

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    @Inject(NOTIFICATION_TRANSPORT) private readonly transport: NotificationTransport,
  ) {}

  async send(input: NotificationInput): Promise<{ id: string; status: string }> {
    const inserted = await this.db
      .insert(notificationLog)
      .values({
        outletId: input.outletId ?? null,
        channel: input.channel,
        template: input.template,
        recipient: input.recipient,
        payload: input.payload,
        status: 'PENDING',
      })
      .returning({ id: notificationLog.id });

    const id = inserted[0]?.id;
    if (id === undefined) {
      return { id: '', status: 'FAILED' };
    }

    try {
      const result = await this.transport.send(input);
      if (!result.ok) {
        await this.mark(id, 'FAILED', result.error ?? 'transport gagal');
        return { id, status: 'FAILED' };
      }
      await this.mark(id, 'SENT');
      return { id, status: 'SENT' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'kesalahan tidak dikenal';
      this.logger.error({ err: error, template: input.template }, 'Notifikasi gagal dikirim');
      await this.mark(id, 'FAILED', message);
      return { id, status: 'FAILED' };
    }
  }

  private async mark(id: string, status: 'SENT' | 'FAILED', error?: string): Promise<void> {
    await this.db
      .update(notificationLog)
      .set({
        status,
        error: error ?? null,
        sentAt: status === 'SENT' ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(notificationLog.id, id));
  }
}
