import { Body, Controller, Get, Headers, HttpCode, Param, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  type Payment,
  createPaymentSchema,
  refundSchema,
  webhookPayloadSchema,
} from '@sarko/contracts';
import { z } from 'zod';

import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Public } from '../../shared/decorators/public.decorator';
import { AppError } from '../../shared/errors/app-error';
import type { HttpRequestLike } from '../../shared/http/http.types';
import { ZodValidationPipe } from '../../shared/validation/zod-validation.pipe';
import { PaymentService } from './payment.service';

@ApiTags('payment')
@Controller('v1/payments')
export class PaymentController {
  constructor(private readonly payments: PaymentService) {}

  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: 'Buat pembayaran untuk order (idempoten via Idempotency-Key)' })
  async create(
    @CurrentUser('id') actorId: string,
    @Body(new ZodValidationPipe(createPaymentSchema)) body: z.infer<typeof createPaymentSchema>,
  ): Promise<Payment> {
    return this.payments.create(actorId, body);
  }

  @Public()
  @Post('webhook')
  @HttpCode(200)
  @ApiHeader({ name: 'X-Sarko-Signature', required: true, description: 'HMAC-SHA256 dari raw body' })
  @ApiOperation({ summary: 'Webhook gateway — diverifikasi HMAC, idempoten per reference' })
  async webhook(
    @Body(new ZodValidationPipe(webhookPayloadSchema)) body: z.infer<typeof webhookPayloadSchema>,
    @Headers('x-sarko-signature') signature: string | undefined,
    @Req() request: HttpRequestLike & { rawBody?: Buffer },
  ): Promise<{ processed: boolean }> {
    if (signature === undefined || signature.length === 0) {
      throw AppError.validation('Header X-Sarko-Signature wajib ada');
    }
    const rawBody = request.rawBody?.toString('utf8') ?? JSON.stringify(request.body ?? body);
    return this.payments.handleWebhook(body, {
      rawBody,
      signature,
      secret: process.env.PAYMENT_GATEWAY_WEBHOOK_SECRET ?? 'change-me-webhook-secret',
    });
  }

  @ApiBearerAuth()
  @Post('refund')
  @HttpCode(201)
  @ApiOperation({ summary: 'Refund penuh/sebagian — hanya untuk order yang sudah dibayar' })
  async refund(
    @CurrentUser('id') actorId: string,
    @Body(new ZodValidationPipe(refundSchema)) body: z.infer<typeof refundSchema>,
  ): Promise<{ refund_id: string; status: string }> {
    return this.payments.refund(actorId, body);
  }

  @ApiBearerAuth()
  @Get(':id')
  @ApiOperation({ summary: 'Detail pembayaran' })
  async getById(@Param('id') id: string): Promise<Payment> {
    return this.payments.getById(id);
  }

  @ApiBearerAuth()
  @Get('order/:orderId')
  @ApiOperation({ summary: 'Semua pembayaran untuk satu order' })
  async listByOrder(@Param('orderId') orderId: string): Promise<Payment[]> {
    return this.payments.listByOrder(orderId);
  }
}
