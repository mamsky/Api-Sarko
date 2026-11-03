import type { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';

import { IdentityService } from './identity.service';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const OUTLET_ID = '22222222-2222-4222-8222-222222222222';

const PASSWORD = 'Sarko123!';
const PIN = '123456';

async function build() {
  const passwordHash = await argon2.hash(PASSWORD, { type: argon2.argon2id });
  const pinHash = await argon2.hash(PIN, { type: argon2.argon2id });

  let failedAttempts = 0;
  let lockedUntil: Date | null = null;

  const repository = {
    findUserByEmail: jest.fn(async () => ({
      id: USER_ID,
      email: 'kasir@sarko.id',
      name: 'Kasir Satu',
      phone: null,
      passwordHash,
      pinHash,
      roleCode: 'KASIR',
      isActive: true,
      failedPinAttempts: 0,
      lockedUntil: null,
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    })),
    findUserById: jest.fn(async () => ({
      id: USER_ID,
      email: 'kasir@sarko.id',
      name: 'Kasir Satu',
      phone: null,
      passwordHash,
      pinHash,
      roleCode: 'KASIR',
      isActive: true,
      failedPinAttempts: 0,
      lockedUntil: null,
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    })),
    findUserForPin: jest.fn(async () => ({
      id: USER_ID,
      email: 'kasir@sarko.id',
      name: 'Kasir Satu',
      roleCode: 'KASIR',
      pinHash,
      failedPinAttempts: failedAttempts,
      lockedUntil,
    })),
    registerPinFailure: jest.fn(async (_id: string, attempts: number, until: Date | null) => {
      failedAttempts = attempts;
      lockedUntil = until;
    }),
    resetPinFailures: jest.fn(async () => {
      failedAttempts = 0;
      lockedUntil = null;
    }),
    recordPinAttempt: jest.fn(async () => undefined),
    touchLastLogin: jest.fn(async () => undefined),
    listOutletIds: jest.fn(async () => [OUTLET_ID]),
    insertRefreshToken: jest.fn(async () => undefined),
    findRefreshToken: jest.fn(async () => undefined),
    revokeRefreshToken: jest.fn(async () => undefined),
    revokeRefreshTokenByToken: jest.fn(async () => undefined),
    findDeviceByHardwareId: jest.fn(async () => undefined),
    findDeviceById: jest.fn(async () => ({
      id: 'dev-uuid',
      outletId: OUTLET_ID,
      deviceId: 'dev_kta_p1',
      deviceName: 'Tablet POS 1',
      deviceType: 'POS',
      platform: 'ANDROID',
      appVersion: '1.3.0',
      status: 'ACTIVE',
      registeredAt: new Date(),
      lastSeenAt: null,
      revokedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
    insertDevice: jest.fn(async (_values: Record<string, unknown>) => ({
      id: 'dev-uuid',
      outletId: OUTLET_ID,
      deviceId: 'dev_kta_p1',
      deviceName: 'Tablet POS 1',
      deviceType: 'POS',
      platform: 'ANDROID',
      appVersion: '1.3.0',
      status: 'ACTIVE',
      registeredAt: new Date(),
      lastSeenAt: null,
      revokedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
    revokeDevice: jest.fn(async () => undefined),
    listDevices: jest.fn(async () => []),
    listRoles: jest.fn(async () => []),
    listStaleDevices: jest.fn(async () => []),
  };

  const jwt = {
    signAsync: jest.fn(async () => 'signed.jwt.token'),
  };

  const service = new IdentityService(repository as never, jwt as unknown as JwtService, {
    pinMaxAttempts: 5,
    pinLockMinutes: 5,
    jwtExpiresIn: '15m',
    jwtRefreshExpiresIn: '30d',
  });

  return { service, repository, jwt };
}

describe('IdentityService', () => {
  it('login dengan password benar mengembalikan user + tokens', async () => {
    const h = await build();

    const result = await h.service.login({ email: 'kasir@sarko.id', password: PASSWORD });

    expect(result.user).toMatchObject({ id: USER_ID, role: 'KASIR', outlet_ids: [OUTLET_ID] });
    expect(result.tokens.token_type).toBe('Bearer');
    expect(result.tokens.expires_in).toBe(900);
  });

  it('login dengan password salah ditolak UNAUTHENTICATED', async () => {
    const h = await build();

    await expect(
      h.service.login({ email: 'kasir@sarko.id', password: 'PasswordSalah!' }),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED', status: 401 });
  });

  it('PIN benar mengembalikan tokens', async () => {
    const h = await build();

    const result = await h.service.loginWithPin({ pin: PIN }, USER_ID);

    expect(result.tokens.access_token).toBe('signed.jwt.token');
    expect(h.repository.resetPinFailures).toHaveBeenCalledWith(USER_ID);
  });

  it('mengunci akun setelah 5 percobaan PIN salah', async () => {
    const h = await build();
    const wrongPin = '000000';

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      await expect(h.service.loginWithPin({ pin: wrongPin }, USER_ID)).rejects.toMatchObject({
        code: 'UNAUTHENTICATED',
      });
    }

    // Percobaan ke-5 memicu lockout.
    await expect(h.service.loginWithPin({ pin: wrongPin }, USER_ID)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });

    expect(h.repository.registerPinFailure).toHaveBeenLastCalledWith(
      USER_ID,
      5,
      expect.any(Date),
    );

    // Setelah terkunci, PIN BENAR pun ditolak.
    await expect(h.service.loginWithPin({ pin: PIN }, USER_ID)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('me mengembalikan profil sesi dengan outlet_ids', async () => {
    const h = await build();
    const user = await h.service.me(USER_ID);

    expect(user).toMatchObject({
      id: USER_ID,
      email: 'kasir@sarko.id',
      role: 'KASIR',
      outlet_ids: [OUTLET_ID],
    });
  });

  it('registerDevice mengembalikan device ACTIVE', async () => {
    const h = await build();

    const device = await h.service.registerDevice('actor-1', {
      device_id: 'dev_kta_p1',
      device_name: 'Tablet POS 1',
      device_type: 'POS',
      outlet_id: OUTLET_ID,
      app_version: '1.3.0',
      platform: 'ANDROID',
    });

    expect(device).toMatchObject({ status: 'ACTIVE', device_id: 'dev_kta_p1' });
    expect(h.repository.insertDevice).toHaveBeenCalledTimes(1);
  });
});
