import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, isNull, lt, or } from 'drizzle-orm';

import { DRIZZLE, type Database } from '../../../database/drizzle.service';
import { hashOpaqueToken } from '../../../shared/crypto/token-hash';
import {
  device,
  pinAttempt,
  refreshToken,
  role,
  user,
  userOutlet,
} from '../../../database/schema';

export type UserRow = typeof user.$inferSelect;
export type DeviceRow = typeof device.$inferSelect;
export type RefreshTokenRow = typeof refreshToken.$inferSelect;

export type PinTarget = {
  id: string;
  email: string;
  name: string;
  roleCode: string;
  pinHash: string | null;
  failedPinAttempts: number;
  lockedUntil: Date | null;
};

@Injectable()
export class IdentityRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async findUserByEmail(email: string): Promise<UserRow | undefined> {
    const rows = await this.db
      .select()
      .from(user)
      .where(and(eq(user.email, email.toLowerCase()), isNull(user.deletedAt)))
      .limit(1);
    return rows[0];
  }

  async findUserById(id: string): Promise<UserRow | undefined> {
    const rows = await this.db.select().from(user).where(eq(user.id, id)).limit(1);
    return rows[0];
  }

  /**
   * Cari user untuk login PIN. Bila `userId` tidak diberikan, PIN dianggap
   * unik di outlet dan user pertama yang cocok dipakai — verifikasi hash
   * tetap dilakukan pemanggil.
   */
  async findUserForPin(userId: string | undefined, pin: string): Promise<PinTarget | undefined> {
    void pin;
    if (userId === undefined) {
      return undefined;
    }

    const rows = await this.db
      .select({
        id: user.id,
        email: user.email,
        name: user.name,
        roleCode: user.roleCode,
        pinHash: user.pinHash,
        failedPinAttempts: user.failedPinAttempts,
        lockedUntil: user.lockedUntil,
      })
      .from(user)
      .where(and(eq(user.id, userId), eq(user.isActive, true), isNull(user.deletedAt)))
      .limit(1);

    return rows[0];
  }

  async listUsersWithPin(): Promise<PinTarget[]> {
    return this.db
      .select({
        id: user.id,
        email: user.email,
        name: user.name,
        roleCode: user.roleCode,
        pinHash: user.pinHash,
        failedPinAttempts: user.failedPinAttempts,
        lockedUntil: user.lockedUntil,
      })
      .from(user)
      .where(and(eq(user.isActive, true), isNull(user.deletedAt)));
  }

  async registerPinFailure(userId: string, attempts: number, lockedUntil: Date | null): Promise<void> {
    await this.db
      .update(user)
      .set({ failedPinAttempts: attempts, lockedUntil, updatedAt: new Date() })
      .where(eq(user.id, userId));
  }

  async resetPinFailures(userId: string): Promise<void> {
    await this.db
      .update(user)
      .set({ failedPinAttempts: 0, lockedUntil: null, updatedAt: new Date() })
      .where(eq(user.id, userId));
  }

  async recordPinAttempt(userId: string, success: boolean): Promise<void> {
    await this.db.insert(pinAttempt).values({ userId, success });
  }

  async touchLastLogin(userId: string): Promise<void> {
    await this.db
      .update(user)
      .set({ lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(user.id, userId));
  }

  async listOutletIds(userId: string): Promise<string[]> {
    const rows = await this.db
      .select({ outletId: userOutlet.outletId })
      .from(userOutlet)
      .where(eq(userOutlet.userId, userId));
    return rows.map((row) => row.outletId);
  }

  async listRoles(): Promise<(typeof role.$inferSelect)[]> {
    return this.db.select().from(role);
  }

  async insertRefreshToken(values: typeof refreshToken.$inferInsert): Promise<void> {
    await this.db.insert(refreshToken).values(values);
  }

  async findRefreshToken(token: string): Promise<RefreshTokenRow | undefined> {
    const rows = await this.db
      .select()
      .from(refreshToken)
      .where(eq(refreshToken.tokenHash, hashOpaqueToken(token)))
      .limit(1);
    return rows[0];
  }

  async revokeRefreshToken(id: string): Promise<void> {
    await this.db
      .update(refreshToken)
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(eq(refreshToken.id, id));
  }

  async revokeRefreshTokenByToken(token: string): Promise<void> {
    await this.db
      .update(refreshToken)
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(eq(refreshToken.tokenHash, hashOpaqueToken(token)));
  }

  async findDeviceByHardwareId(hardwareId: string): Promise<DeviceRow | undefined> {
    const rows = await this.db
      .select()
      .from(device)
      .where(eq(device.deviceId, hardwareId))
      .limit(1);
    return rows[0];
  }

  async findDeviceById(id: string): Promise<DeviceRow | undefined> {
    const rows = await this.db.select().from(device).where(eq(device.id, id)).limit(1);
    return rows[0];
  }

  async insertDevice(values: typeof device.$inferInsert): Promise<DeviceRow> {
    const rows = await this.db.insert(device).values(values).returning();
    const row = rows[0];
    if (row === undefined) {
      throw new Error('Insert device tidak mengembalikan baris');
    }
    return row;
  }

  async revokeDevice(id: string): Promise<void> {
    await this.db
      .update(device)
      .set({ status: 'REVOKED', revokedAt: new Date(), updatedAt: new Date() })
      .where(eq(device.id, id));
  }

  async listDevices(outletId?: string): Promise<DeviceRow[]> {
    return this.db
      .select()
      .from(device)
      .where(outletId === undefined ? undefined : eq(device.outletId, outletId))
      .orderBy(desc(device.registeredAt));
  }

  async listStaleDevices(threshold: Date): Promise<DeviceRow[]> {
    return this.db
      .select()
      .from(device)
      .where(
        and(
          eq(device.status, 'ACTIVE'),
          or(isNull(device.lastSeenAt), lt(device.lastSeenAt, threshold)),
        ),
      );
  }
}
