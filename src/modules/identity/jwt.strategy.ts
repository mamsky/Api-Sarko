import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { AppError } from '../../shared/errors/app-error';
import { IdentityService, type AuthenticatedUser } from './identity.service';

export type JwtPayload = {
  sub: string;
  email?: string;
  role?: string;
  outlet_ids?: string[];
};

/**
 * Strategi JWT: memvalidasi signature + memastikan user masih aktif di DB.
 * `secret` diambil dari config, bukan hard-coded.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    config: ConfigService,
    private readonly identity: IdentityService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET', 'sarko-development-secret-change-me'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
      throw new UnauthorizedException('Token tidak memuat subject');
    }

    try {
      return await this.identity.validateTokenPayload({ sub: payload.sub });
    } catch (error) {
      if (error instanceof AppError) {
        throw new UnauthorizedException(error.detail);
      }
      this.logger.error({ err: error }, 'Validasi token gagal');
      throw new UnauthorizedException('Token tidak valid');
    }
  }
}
