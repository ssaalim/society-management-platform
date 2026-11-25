import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Razorpay (online payments) over its REST API. Enabled only when RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are set;
 * RAZORPAY_WEBHOOK_SECRET enables the server-to-server webhook (recommended, so a payment is recorded even if the
 * resident closes the browser before returning).
 */
@Injectable()
export class RazorpayService {
  private readonly logger = new Logger(RazorpayService.name);
  readonly keyId = process.env.RAZORPAY_KEY_ID || '';
  private readonly keySecret = process.env.RAZORPAY_KEY_SECRET || '';
  private readonly webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || '';

  get enabled() {
    return !!(this.keyId && this.keySecret);
  }

  async createOrder(amountRupees: number, receipt: string, notes: Record<string, string>) {
    const res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64')}`,
      },
      body: JSON.stringify({ amount: Math.round(amountRupees * 100), currency: 'INR', receipt: receipt.slice(0, 40), notes }),
    });
    const body: any = await res.json().catch(() => ({}));
    if (!res.ok || !body?.id) {
      this.logger.error(`Razorpay order failed (${res.status}): ${body?.error?.description || 'no body'}`);
      throw new BadGatewayException('The payment gateway is not responding. Please try again in a few minutes.');
    }
    return body as { id: string; amount: number; currency: string };
  }

  /** Checkout's handler signature: HMAC-SHA256(order_id|payment_id) with the key secret. */
  verifyPayment(orderId: string, paymentId: string, signature: string) {
    if (!this.enabled) return false;
    return safeEqual(createHmac('sha256', this.keySecret).update(`${orderId}|${paymentId}`).digest('hex'), signature);
  }

  verifyWebhook(rawBody: Buffer, signature: string | undefined) {
    if (!this.webhookSecret || !signature) return false;
    return safeEqual(createHmac('sha256', this.webhookSecret).update(rawBody).digest('hex'), signature);
  }
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
