import { Module } from '@nestjs/common';

import { NOTIFICATION_TRANSPORT, NotificationService, type NotificationTransport } from './notification.service';

/** Transport default: mencatat ke log. Diganti adapter FCM/WA di produksi. */
const logTransport: NotificationTransport = {
  async send(input) {
    process.stdout.write(
      `[notification] ${input.channel} template=${input.template} to=${input.recipient}\n`,
    );
    return { ok: true };
  },
};

@Module({
  providers: [
    NotificationService,
    { provide: NOTIFICATION_TRANSPORT, useValue: logTransport },
  ],
  exports: [NotificationService],
})
export class NotificationModule {}
