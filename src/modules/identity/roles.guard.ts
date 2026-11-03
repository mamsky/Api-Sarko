import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@sarko/contracts';

import { AppError } from '../../shared/errors/app-error';
import { IS_PUBLIC_KEY } from '../../shared/decorators/public.decorator';
import { ROLES_KEY } from '../../shared/decorators/roles.decorator';

/**
 * RBAC guard yang membaca `@Roles(...)`. Lima role berasal dari
 * `@sarko/contracts` — tidak ada daftar role yang ditulis ulang di sini.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic === true) {
      return true;
    }

    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (required === undefined || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: { role?: Role } }>();
    const role = request.user?.role;

    if (role === undefined) {
      throw AppError.unauthorized();
    }
    if (!required.includes(role)) {
      throw AppError.forbidden(
        `Role ${role} tidak berhak; dibutuhkan salah satu dari ${required.join(', ')}`,
      );
    }
    return true;
  }
}
