import { toDecimalString } from "./money";

/**
 * PayPal REST client (server only). Sandbox by default.
 *  - Orders API v2: create + capture member contributions
 *  - Payouts API v1: agent pays the payee
 *  - Payments API v2: refund a captured contribution
 */
const API = process.env.PAYPAL_API_BASE || "https://api-m.sandbox.paypal.com";
const CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const SECRET = process.env.PAYPAL_CLIENT_SECRET;

export class PayPalNotConfigured extends Error {
  constructor() {
    super("PayPal sandbox not configured: set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET");
  }
}

export class PayPalError extends Error {
  constructor(message: string, public status: number, public debugId?: string, public details?: unknown) {
    super(message);
  }
}

export const paypalConfigured = () => !!(CLIENT_ID && SECRET);
export const paypalEnv = API.includes("sandbox") ? "sandbox" : "live";

const cache = globalThis as unknown as { __ppToken?: { token: string; exp: number } };

async function accessToken(): Promise<string> {
  if (!CLIENT_ID || !SECRET) throw new PayPalNotConfigured();
  if (cache.__ppToken && cache.__ppToken.exp > Date.now() + 60_000) return cache.__ppToken.token;
  const r = await fetch(`${API}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${SECRET}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new PayPalError(`PayPal auth failed: ${d.error_description ?? r.status}`, r.status);
  cache.__ppToken = { token: d.access_token, exp: Date.now() + d.expires_in * 1000 };
  return d.access_token;
}

async function pp<T = any>(path: string, init: { method?: string; body?: unknown; requestId?: string } = {}): Promise<T> {
  const token = await accessToken();
  const r = await fetch(`${API}${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.requestId ? { "PayPal-Request-Id": init.requestId } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const text = await r.text();
  const d = text ? JSON.parse(text) : {};
  if (!r.ok) {
    const issue = d.details?.[0]?.issue || d.details?.[0]?.description;
    throw new PayPalError(`PayPal ${d.name ?? r.status}${issue ? `: ${issue}` : d.message ? `: ${d.message}` : ""}`, r.status, d.debug_id, d.details);
  }
  return d as T;
}

/** Create an order for a member's contribution. custom_id ties the capture back to pot + member. */
export async function createOrder(o: { amount: number; currency: string; potId: string; memberId: string; potName: string }) {
  const d = await pp("/v2/checkout/orders", {
    method: "POST",
    body: {
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: o.potId,
          custom_id: `${o.potId}:${o.memberId}`,
          description: `Contribution to ${o.potName} (Chai Pot)`.slice(0, 127),
          amount: { currency_code: o.currency, value: toDecimalString(o.amount) },
        },
      ],
      payment_source: {
        paypal: { experience_context: { brand_name: "Chai Pot", shipping_preference: "NO_SHIPPING", user_action: "PAY_NOW" } },
      },
    },
  });
  return { id: d.id as string, status: d.status as string };
}

export interface CaptureResult {
  orderId: string;
  status: string;
  captureId: string;
  captureStatus: string;
  amount: number;
  currency: string;
  customId?: string;
  payerEmail?: string;
}

export async function captureOrder(orderId: string): Promise<CaptureResult> {
  if (!/^[A-Z0-9]{5,40}$/.test(orderId)) throw new Error("Invalid order id");
  const d = await pp(`/v2/checkout/orders/${orderId}/capture`, { method: "POST", requestId: `capture-${orderId}` });
  const pu = d.purchase_units?.[0];
  const cap = pu?.payments?.captures?.[0];
  if (!cap) throw new PayPalError("Capture missing from PayPal response", 502, d.debug_id);
  const [whole, frac = "00"] = String(cap.amount.value).split(".");
  return {
    orderId: d.id,
    status: d.status,
    captureId: cap.id,
    captureStatus: cap.status,
    amount: Number(whole) * 100 + Number(frac.padEnd(2, "0").slice(0, 2)),
    currency: cap.amount.currency_code,
    customId: cap.custom_id ?? pu?.custom_id,
    payerEmail: d.payer?.email_address,
  };
}

/** Pay one payee by email. senderBatchId makes retries idempotent. */
export async function createPayout(o: { senderBatchId: string; email: string; amount: number; currency: string; note: string }) {
  const d = await pp("/v1/payments/payouts", {
    method: "POST",
    requestId: o.senderBatchId,
    body: {
      sender_batch_header: {
        sender_batch_id: o.senderBatchId,
        email_subject: "You have a payment from a Chai Pot",
        email_message: o.note.slice(0, 1000),
      },
      items: [
        {
          recipient_type: "EMAIL",
          receiver: o.email,
          amount: { value: toDecimalString(o.amount), currency: o.currency },
          note: o.note.slice(0, 4000),
          sender_item_id: o.senderBatchId,
        },
      ],
    },
  });
  return { batchId: d.batch_header.payout_batch_id as string, status: d.batch_header.batch_status as string };
}

export async function getPayoutBatch(batchId: string) {
  if (!/^[A-Z0-9]{5,40}$/.test(batchId)) throw new Error("Invalid batch id");
  const d = await pp(`/v1/payments/payouts/${batchId}`);
  const item = d.items?.[0];
  return {
    status: d.batch_header.batch_status as string,
    itemStatus: item?.transaction_status as string | undefined,
    transactionId: item?.transaction_id as string | undefined,
  };
}

export async function refundCapture(o: { captureId: string; amount: number; currency: string; requestId: string; note: string }) {
  if (!/^[A-Z0-9]{5,40}$/.test(o.captureId)) throw new Error("Invalid capture id");
  const d = await pp(`/v2/payments/captures/${o.captureId}/refund`, {
    method: "POST",
    requestId: o.requestId,
    body: { amount: { value: toDecimalString(o.amount), currency_code: o.currency }, note_to_payer: o.note.slice(0, 255) },
  });
  return { id: d.id as string, status: d.status as string };
}
