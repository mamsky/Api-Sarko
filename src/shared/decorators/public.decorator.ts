import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Role } from '@sarko/contracts';

export const IS_PUBLIC_KEY = 'sarko:is_public';

/** Tandai endpoint yang tidak butuh JWT (health, login, webhook). */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);
