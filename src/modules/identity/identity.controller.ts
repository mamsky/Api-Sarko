import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  type Device,
  type LoginResponse,
  type SessionUser,
  loginSchema,
  pinSchema,
  registerDeviceSchema,
} from '@sarko/contracts';
import { z } from 'zod';

import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Public } from '../../shared/decorators/public.decorator';
import { Roles } from '../../shared/decorators/roles.decorator';
import { ZodValidationPipe } from '../../shared/validation/zod-validation.pipe';
import { RolesGuard } from './roles.guard';
import { IdentityService, type OutletSummary } from './identity.service';

const pinLoginSchema = pinSchema.extend({ user_id: z.string().uuid().optional() });
const refreshSchema = z.object({ refresh_token: z.string().min(1) });

@ApiTags('identity')
@Controller('v1')
export class IdentityController {
  constructor(private readonly identity: IdentityService) {}

  @Public()
  @Post('auth/login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Login email + password (Argon2id)' })
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: z.infer<typeof loginSchema>,
  ): Promise<LoginResponse> {
    return this.identity.login(body);
  }

  @Public()
  @Post('auth/pin')
  @HttpCode(200)
  @ApiOperation({ summary: 'Login cepat dengan PIN 6 digit (lockout 5x gagal)' })
  async pinLogin(
    @Body(new ZodValidationPipe(pinLoginSchema)) body: z.infer<typeof pinLoginSchema>,
  ): Promise<LoginResponse> {
    return this.identity.loginWithPin({ pin: body.pin }, body.user_id);
  }

  @Public()
  @Post('auth/refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Tukar refresh token dengan pasangan token baru' })
  async refresh(
    @Body(new ZodValidationPipe(refreshSchema)) body: z.infer<typeof refreshSchema>,
  ): Promise<LoginResponse> {
    return this.identity.refresh(body.refresh_token);
  }

  @ApiBearerAuth()
  @Get('auth/me')
  @ApiOperation({ summary: 'Profil sesi saat ini' })
  async me(@CurrentUser('id') userId: string): Promise<SessionUser> {
    return this.identity.me(userId);
  }

  @ApiBearerAuth()
  @Post('devices/register')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'MANAGER_OUTLET', 'KASIR')
  @ApiOperation({ summary: 'Daftarkan device ke outlet (device binding)' })
  async registerDevice(
    @CurrentUser('id') actorId: string,
    @Body(new ZodValidationPipe(registerDeviceSchema)) body: z.infer<typeof registerDeviceSchema>,
  ): Promise<Device> {
    return this.identity.registerDevice(actorId, body);
  }

  @ApiBearerAuth()
  @Post('devices/:id/revoke')
  @HttpCode(200)
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'MANAGER_OUTLET')
  @ApiOperation({ summary: 'Cabut akses device' })
  async revokeDevice(
    @CurrentUser('id') actorId: string,
    @Param('id') id: string,
  ): Promise<{ id: string; status: string }> {
    return this.identity.revokeDevice(actorId, id);
  }

  @ApiBearerAuth()
  @Get('devices')
  @ApiOperation({ summary: 'Daftar device (opsional filter outlet)' })
  async listDevices(@CurrentUser('outletIds') outletIds: string[]): Promise<Device[]> {
    return this.identity.listDevices(outletIds[0]);
  }

  @ApiBearerAuth()
  @Get('outlets')
  @ApiOperation({ summary: 'Daftar outlet yang boleh diakses user yang login' })
  async listOutlets(
    @CurrentUser('outletIds') outletIds: string[],
  ): Promise<OutletSummary[]> {
    return this.identity.listOutlets(outletIds);
  }
}
