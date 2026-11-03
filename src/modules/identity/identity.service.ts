import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type {
  Device,
  LoginInput,
  LoginResponse,
  PinInput,
  RegisterDeviceInput,
  Role,
  SessionUser,
} from '@sarko/contracts';
import * as argon2 from 'argon2';

import { hashOpaqueToken } from '../../shared/crypto/token-hash';
import { AppError } from '../../shared/errors/app-error';
import { newId } from '../../shared/id/id';
import { IdentityRepository } from './repositories/identity.repository';

export type IdentityConfig = {
  pinMaxAttempts: number;
  pinLockMinutes: number;
  jwtExpiresIn: string;
  jwtRefreshExpiresIn: string;
};

export type AuthenticatedUser = {
  id: string;
  email: string;
  role: Role;
  outletIds: string[];
};

/**
 * Autentikasi & manajemen device (PRD FR-AUTH, FR-ID).
 *
 * PIN disimpan sebagai Argon2id. Lima percobaan gagal berturut-turut mengunci
 * akun 5 menit — lockout disimpan di DB agar tidak hilang saat restart.
 */
@Injectable()
export class IdentityService {
  private readonly logger = new Logger(IdentityService.name);

  constructor(
    private readonly repository: IdentityRepository,
    private readonly jwt: JwtService,
    @Optional()
    @Inject('IDENTITY_CONFIG')
    private readonly config: IdentityConfig = {
      pinMaxAttempts: 5,
      pinLockMinutes: 5,
      jwtExpiresIn: '15m',
      jwtRefreshExpiresIn: '30d',
    },
  ) {}

  async login(dto: LoginInput): Promise<LoginResponse> {
    const user = await this.repository.findUserByEmail(dto.email);
    if (user === undefined) {
      throw AppError.unauthorized('Email atau password salah');
    }
    if (!user.isActive) {
      throw AppError.forbidden('Akun tidak aktif');
    }

    const valid = await argon2.verify(user.passwordHash, dto.password);
    if (!valid) {
      throw AppError.unauthorized('Email atau password salah');
    }

    await this.repository.touchLastLogin(user.id);

    const session = await this.buildSession(user.id, user.email, user.name, user.roleCode as Role);
    return session;
  }

  /**
   * Login PIN cepat untuk kasir/koki di POS & KDS.
   * Lockout setelah `pinMaxAttempts` gagal: `locked_until = now + pinLockMinutes`.
   */
  async loginWithPin(dto: PinInput, userId?: string): Promise<LoginResponse> {
    const target = await this.repository.findUserForPin(userId, dto.pin);
    if (target === undefined) {
      throw AppError.unauthorized('PIN salah');
    }

    const now = new Date();
    if (target.lockedUntil !== null && target.lockedUntil.getTime() > now.getTime()) {
      throw AppError.forbidden(
        `Akun terkunci sampai ${target.lockedUntil.toISOString()} karena percobaan PIN gagal`,
      );
    }

    if (target.pinHash === null) {
      throw AppError.forbidden('PIN belum diatur untuk akun ini');
    }

    const valid = await argon2.verify(target.pinHash, dto.pin);
    if (!valid) {
      const attempts = target.failedPinAttempts + 1;
      const shouldLock = attempts >= this.config.pinMaxAttempts;
      const lockedUntil = shouldLock
        ? new Date(now.getTime() + this.config.pinLockMinutes * 60_000)
        : null;

      await this.repository.registerPinFailure(target.id, attempts, lockedUntil);
      await this.repository.recordPinAttempt(target.id, false);

      this.logger.warn({ userId: target.id, attempts, locked: shouldLock }, 'PIN salah');

      if (shouldLock) {
        throw AppError.forbidden(
          `PIN salah ${attempts} kali. Akun terkunci ${this.config.pinLockMinutes} menit`,
        );
      }
      throw AppError.unauthorized('PIN salah');
    }

    await this.repository.resetPinFailures(target.id);
    await this.repository.recordPinAttempt(target.id, true);
    await this.repository.touchLastLogin(target.id);

    return this.buildSession(target.id, target.email, target.name, target.roleCode as Role);
  }

  async me(userId: string): Promise<SessionUser> {
    const user = await this.repository.findUserById(userId);
    if (user === undefined) {
      throw AppError.notFound('User');
    }
    const outletIds = await this.repository.listOutletIds(userId);
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.roleCode as Role,
      outlet_ids: outletIds,
    };
  }

  async registerDevice(actorId: string, dto: RegisterDeviceInput): Promise<Device> {
    void actorId;
    const existing = await this.repository.findDeviceByHardwareId(dto.device_id);
    if (existing !== undefined) {
      if (existing.status === 'REVOKED') {
        throw AppError.deviceRevoked();
      }
      return toDeviceContract(existing);
    }

    const row = await this.repository.insertDevice({
      id: newId(),
      outletId: dto.outlet_id,
      deviceId: dto.device_id,
      deviceName: dto.device_name,
      deviceType: dto.device_type,
      platform: dto.platform,
      appVersion: dto.app_version,
      status: 'ACTIVE',
      registeredAt: new Date(),
    });

    return toDeviceContract(row);
  }

  async revokeDevice(actorId: string, deviceUuid: string): Promise<{ id: string; status: string }> {
    const device = await this.repository.findDeviceById(deviceUuid);
    if (device === undefined) {
      throw AppError.notFound('Device');
    }
    await this.repository.revokeDevice(deviceUuid);
    this.logger.log({ actorId, deviceUuid }, 'Device dicabut');
    return { id: deviceUuid, status: 'REVOKED' };
  }

  async listDevices(outletId?: string): Promise<Device[]> {
    const rows = await this.repository.listDevices(outletId);
    return rows.map(toDeviceContract);
  }

  async refresh(refreshToken: string): Promise<LoginResponse> {
    const stored = await this.repository.findRefreshToken(refreshToken);
    if (stored === undefined) {
      throw AppError.unauthorized('Refresh token tidak valid');
    }
    if (stored.expiresAt.getTime() < Date.now() || stored.revokedAt !== null) {
      throw AppError.unauthorized('Refresh token sudah kedaluwarsa');
    }

    const user = await this.repository.findUserById(stored.userId);
    if (user === undefined) {
      throw AppError.notFound('User');
    }

    await this.repository.revokeRefreshToken(stored.id);
    return this.buildSession(user.id, user.email, user.name, user.roleCode as Role);
  }

  async logout(refreshToken: string): Promise<void> {
    await this.repository.revokeRefreshTokenByToken(refreshToken);
  }

  /** Dipakai `JwtStrategy` untuk memvalidasi payload token. */
  async validateTokenPayload(payload: { sub: string }): Promise<AuthenticatedUser> {
    const user = await this.repository.findUserById(payload.sub);
    if (user === undefined || !user.isActive) {
      throw AppError.unauthorized('User tidak valid');
    }
    const outletIds = await this.repository.listOutletIds(user.id);
    return {
      id: user.id,
      email: user.email,
      role: user.roleCode as Role,
      outletIds,
    };
  }

  private async buildSession(
    userId: string,
    email: string,
    name: string,
    role: Role,
  ): Promise<LoginResponse> {
    const outletIds = await this.repository.listOutletIds(userId);

    const accessToken = await this.jwt.signAsync(
      { sub: userId, email, role, outlet_ids: outletIds },
      { expiresIn: this.config.jwtExpiresIn },
    );
    const refreshToken = await this.jwt.signAsync(
      { sub: userId, type: 'refresh' },
      { expiresIn: this.config.jwtRefreshExpiresIn },
    );

    await this.repository.insertRefreshToken({
      id: newId(),
      userId,
      tokenHash: hashOpaqueToken(refreshToken),
      expiresAt: new Date(Date.now() + 30 * 24 * 3_600_000),
    });

    return {
      user: { id: userId, name, email, role, outlet_ids: outletIds },
      tokens: {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_in: parseExpiresIn(this.config.jwtExpiresIn),
        token_type: 'Bearer',
      },
    };
  }
}

/** "15m" → 900 detik. Dipakai klien untuk menjadwalkan refresh. */
export function parseExpiresIn(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value);
  if (match === null) {
    return 900;
  }
  const amount = Number(match[1]);
  const unit = match[2];
  const multiplier = unit === 's' ? 1 : unit === 'm' ? 60 : unit === 'h' ? 3_600 : 86_400;
  return amount * multiplier;
}

function toDeviceContract(row: {
  id: string;
  deviceId: string;
  deviceName: string;
  deviceType: string;
  outletId: string;
  appVersion: string;
  platform: string;
  status: string;
  registeredAt: Date;
  lastSeenAt: Date | null;
}): Device {
  return {
    id: row.id,
    device_id: row.deviceId,
    device_name: row.deviceName,
    device_type: row.deviceType as Device['device_type'],
    outlet_id: row.outletId,
    app_version: row.appVersion,
    platform: row.platform as Device['platform'],
    status: row.status as Device['status'],
    registered_at: row.registeredAt.toISOString(),
    last_seen_at: row.lastSeenAt?.toISOString() ?? null,
  };
}
