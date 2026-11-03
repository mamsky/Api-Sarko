import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';

import { IdentityRepository } from '../modules/identity/repositories/identity.repository';
import { NotificationService } from '../modules/notification/notification.service';

export type StaleDevice = {
  device_id: string;
  device_name: string;
  outlet_id: string;
  last_seen_at: string | null;
};

/**
 * Deteksi device yang berhenti mengirim heartbeat (PRD §7.12.12).
 *
 * Ambang default 10 menit; bila `last_seen_at` lebih tua, device dianggap
 * offline dan alert dikirim ke manager outlet.
 */
@Injectable()
export class DeviceHeartbeatMonitorJob {
  private readonly logger = new Logger(DeviceHeartbeatMonitorJob.name);

  constructor(
    private readonly identity: IdentityRepository,
    private readonly notifications: NotificationService,
    private readonly config: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async monitor(): Promise<void> {
    const timeoutSeconds = Number(
      this.config.get('DEVICE_HEARTBEAT_TIMEOUT_SECONDS', 600),
    );
    const threshold = new Date(Date.now() - timeoutSeconds * 1_000);

    const devices = await this.identity.listStaleDevices(threshold);
    const stale = devices.filter(
      (device) =>
        device.lastSeenAt === null || device.lastSeenAt.getTime() < threshold.getTime(),
    );

    if (stale.length === 0) {
      return;
    }

    this.logger.warn({ count: stale.length }, 'Device tidak mengirim heartbeat');

    for (const device of stale) {
      await this.notifications.send({
        outletId: device.outletId,
        channel: 'PUSH',
        template: 'device_offline',
        recipient: device.deviceName,
        payload: {
          device_id: device.deviceId,
          device_name: device.deviceName,
          last_seen_at: device.lastSeenAt?.toISOString() ?? null,
        },
      });
    }
  }

  async listStale(timeoutSeconds = 600): Promise<StaleDevice[]> {
    const threshold = new Date(Date.now() - timeoutSeconds * 1_000);
    const devices = await this.identity.listStaleDevices(threshold);

    return devices
      .filter((device) => device.lastSeenAt === null || device.lastSeenAt.getTime() < threshold.getTime())
      .map((device) => ({
        device_id: device.deviceId,
        device_name: device.deviceName,
        outlet_id: device.outletId,
        last_seen_at: device.lastSeenAt?.toISOString() ?? null,
      }));
  }
}
