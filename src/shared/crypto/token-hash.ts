import { createHash } from 'node:crypto';

/**
 * Hash token acak (refresh token) sebelum disimpan ke database.
 *
 * Memakai SHA-256, bukan hash rolling 32-bit: nilai yang disimpan harus tahan
 * terhadap tebakan balik bila dump database bocor. Token acak berentropi tinggi
 * tidak butuh salt/Argon2 (bukan password), cukup digest satu arah.
 *
 * Satu implementasi dipakai saat MENULIS (`buildSession`) dan saat MEMBACA
 * (`findRefreshToken`) — dua salinan terpisah pernah menyebabkan refresh selalu
 * 401 karena hash-nya berbeda.
 */
export function hashOpaqueToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}
