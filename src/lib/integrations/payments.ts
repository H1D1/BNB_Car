import "server-only";
import { randomUUID } from "node:crypto";
import type { PaymentMethod } from "../types";

export type CardInput = { number: string; expiry: string; cvc: string; holder: string };

export type ChargeResult =
  | { status: "paid"; providerRef: string; last4: string; brand: string }
  | { status: "failed"; reason: "declined" | "invalid_card" };

/**
 * Payment gateway abstraction.
 *
 * Production wiring:
 *  - "cmi": CMI (Centre Monétique Interbancaire) hosted payment page. The real flow is a
 *    redirect: build the signed form (clientid, amount, oid, okUrl, failUrl, callbackUrl, rnd,
 *    hash = SHA-512 of params + store key), POST it to the CMI gateway, then confirm the
 *    payment in the server-to-server callback before marking the booking paid.
 *  - "card": an international acquirer (e.g. Stripe / Checkout.com / PayZone) charging in MAD.
 * Card data must never touch our servers in production — use the provider's hosted fields.
 */
export interface PaymentGateway {
  charge(input: { bookingId: string; amountMad: number; method: Exclude<PaymentMethod, "cash">; card: CardInput }): Promise<ChargeResult>;
  /** Authorise (hold) the security deposit without capturing it. */
  holdDeposit(input: { bookingId: string; amountMad: number; card: CardInput }): Promise<{ providerRef: string } | null>;
}

const luhn = (num: string) => {
  let sum = 0;
  let dbl = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let d = Number(num[i]);
    if (dbl && (d *= 2) > 9) d -= 9;
    sum += d;
    dbl = !dbl;
  }
  return sum % 10 === 0;
};

const brandOf = (n: string) => (/^4/.test(n) ? "VISA" : /^(5[1-5]|2[2-7])/.test(n) ? "MASTERCARD" : /^3[47]/.test(n) ? "AMEX" : "CARD");

export function validateCard(card: CardInput) {
  const number = card.number.replace(/\D/g, "");
  const [mm, yy] = card.expiry.split("/").map((s) => Number(s.trim()));
  const now = new Date();
  const expOk = mm >= 1 && mm <= 12 && yy >= 0 && new Date(2000 + yy, mm, 1) > now;
  return number.length >= 13 && number.length <= 19 && expOk && /^\d{3,4}$/.test(card.cvc) && card.holder.trim().length >= 2;
}

/** Test-mode gateway: accepts any well-formed card; numbers ending in 0002 are declined. Luhn is not enforced so testers can type anything. */
class MockGateway implements PaymentGateway {
  async charge({ method, card }: Parameters<PaymentGateway["charge"]>[0]): Promise<ChargeResult> {
    await new Promise((r) => setTimeout(r, 900)); // simulate 3-D Secure round-trip
    const number = card.number.replace(/\D/g, "");
    if (!validateCard(card)) return { status: "failed", reason: "invalid_card" };
    if (number.endsWith("0002")) return { status: "failed", reason: "declined" };
    void luhn;
    return {
      status: "paid",
      providerRef: `${method === "cmi" ? "CMI" : "MOCK"}-${randomUUID().slice(0, 8).toUpperCase()}`,
      last4: number.slice(-4),
      brand: method === "cmi" ? "CMI" : brandOf(number),
    };
  }
  async holdDeposit() {
    return { providerRef: `HOLD-${randomUUID().slice(0, 8).toUpperCase()}` };
  }
}

export function getPaymentGateway(): PaymentGateway {
  // switch on process.env.PAYMENT_PROVIDER once real gateways are integrated
  return new MockGateway();
}
