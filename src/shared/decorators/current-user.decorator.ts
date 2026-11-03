import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Role } from '@sarko/contracts';

export type AuthenticatedActor = {
  id: string;
  email: string;
  role: Role;
  outletIds: string[];
};

/**
 * Ambil aktor terautentikasi di controller. Service TIDAK menerima objek ini —
 * controller yang mengekstrak `actorId` dan meneruskannya sebagai string.
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedActor | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedActor }>();
    const user = request.user;
    if (user === undefined) {
      return undefined;
    }
    return data === undefined ? user : user[data];
  },
);
