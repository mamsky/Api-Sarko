import { z } from 'zod';

import { uuidSchema } from '../common/identifiers.js';

export const deviceTypeSchema = z.enum(['POS', 'KDS', 'MOBILE']);
export type DeviceType = z.infer<typeof deviceTypeSchema>;

export const devicePlatformSchema = z.enum(['ANDROID', 'IOS', 'WEB']);
export type DevicePlatform = z.infer<typeof devicePlatformSchema>;

export const deviceStatusSchema = z.enum(['ACTIVE', 'REVOKED']);
export type DeviceStatus = z.infer<typeof deviceStatusSchema>;

/**
 * Registrasi device. `device_id` adalah identitas hardware yang persisten;
 * server memetakan ke UUID internal + mengikatnya ke outlet.
 */
export const registerDeviceSchema = z.object({
  device_id: z.string().min(1).describe('ID hardware persisten dari device'),
  device_name: z.string().min(1).max(100),
  device_type: deviceTypeSchema,
  outlet_id: uuidSchema,
  app_version: z.string().min(1).describe('Versi app, untuk gate kompatibilitas sync'),
  platform: devicePlatformSchema,
});
export type RegisterDeviceInput = z.infer<typeof registerDeviceSchema>;

export const deviceSchema = registerDeviceSchema.extend({
  id: uuidSchema,
  status: deviceStatusSchema,
  registered_at: z.string().datetime(),
  last_seen_at: z.string().datetime().nullable(),
});
export type Device = z.infer<typeof deviceSchema>;
