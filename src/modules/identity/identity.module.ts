import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { IdentityController } from './identity.controller';
import { IdentityService } from './identity.service';
import { JwtStrategy } from './jwt.strategy';
import { IdentityRepository } from './repositories/identity.repository';
import { RolesGuard } from './roles.guard';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'sarko-development-secret-change-me'),
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN', '15m') },
      }),
    }),
  ],
  controllers: [IdentityController],
  providers: [
    IdentityService,
    IdentityRepository,
    JwtStrategy,
    RolesGuard,
    {
      provide: 'IDENTITY_CONFIG',
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinMaxAttempts: Number(config.get('PIN_MAX_ATTEMPTS', 5)),
        pinLockMinutes: Number(config.get('PIN_LOCK_MINUTES', 5)),
        jwtExpiresIn: config.get<string>('JWT_EXPIRES_IN', '15m'),
        jwtRefreshExpiresIn: config.get<string>('JWT_REFRESH_EXPIRES_IN', '30d'),
      }),
    },
  ],
  exports: [IdentityService, IdentityRepository, RolesGuard],
})
export class IdentityModule {}
