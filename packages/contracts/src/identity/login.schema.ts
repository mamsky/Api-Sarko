import { z } from 'zod';

import { uuidSchema } from '../common/identifiers.js';

/** 5 role SARKO (PRD §6) — single source untuk RBAC backend & guard admin. */
export const roleSchema = z.enum(['SUPER_ADMIN', 'MANAGER_OUTLET', 'KASIR', 'KOKI', 'PELANGGAN']);
export type Role = z.infer<typeof roleSchema>;

export const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: 'Super Admin',
  MANAGER_OUTLET: 'Manajer Outlet',
  KASIR: 'Kasir',
  KOKI: 'Koki',
  PELANGGAN: 'Pelanggan',
};

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

/** PIN 6 digit untuk login cepat kasir/koki di POS & KDS. */
export const pinSchema = z.object({
  pin: z.string().regex(/^\d{6}$/, 'PIN harus 6 digit'),
});
export type PinInput = z.infer<typeof pinSchema>;

export const authTokensSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_in: z.number().int().describe('Masa berlaku access_token dalam detik'),
  token_type: z.literal('Bearer'),
});
export type AuthTokens = z.infer<typeof authTokensSchema>;

export const sessionUserSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  email: z.string().email(),
  role: roleSchema,
  outlet_ids: z.array(uuidSchema).describe('Outlet yang boleh diakses user ini'),
});
export type SessionUser = z.infer<typeof sessionUserSchema>;

export const loginResponseSchema = z.object({
  user: sessionUserSchema,
  tokens: authTokensSchema,
});
export type LoginResponse = z.infer<typeof loginResponseSchema>;

export const refreshTokenSchema = z.object({
  refresh_token: z.string(),
});
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
