import { type ArgumentMetadata, Injectable, type PipeTransform } from '@nestjs/common';
import type { ZodTypeAny, z } from 'zod';

/**
 * Pipe validasi berbasis schema `@sarko/contracts`.
 *
 * Dipakai per-parameter (`@Body(new ZodValidationPipe(schema))`) supaya
 * tipe yang masuk ke controller benar-benar hasil parse Zod, bukan `any`.
 * `ZodError` diteruskan apa adanya dan diterjemahkan `ProblemDetailFilter`
 * menjadi RFC 7807 dengan `errors[]` per field.
 */
@Injectable()
export class ZodValidationPipe<T extends ZodTypeAny> implements PipeTransform<unknown, z.infer<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown, _metadata: ArgumentMetadata): z.infer<T> {
    return this.schema.parse(value);
  }
}
