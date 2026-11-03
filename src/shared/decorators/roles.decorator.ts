import { SetMetadata } from '@nestjs/common';
import type { Role } from '@sarko/contracts';

export const ROLES_KEY = 'sarko:roles';

/** Batasi endpoint ke role tertentu (5 role dari `@sarko/contracts`). */
export const Roles = (...roles: Role[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
