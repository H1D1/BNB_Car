import "server-only";

/**
 * OTP delivery (SMS / WhatsApp).
 *
 * Choose the provider with `SMS_PROVIDER` (default: "mock").
 *
 * Plugging a real provider:
 *  - Twilio SMS:       SMS_PROVIDER=twilio, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM (or TWILIO_MESSAGING_SERVICE_SID).
 *                      POST https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json  (To, From, Body) with basic auth.
 *                      Twilio Verify can also replace our own code generation entirely.
 *  - Twilio WhatsApp:  same endpoint with `From=whatsapp:+14155238886` / `To=whatsapp:+2126…`. Outside the 24h session
 *                      window WhatsApp requires an approved *authentication template* (ContentSid + ContentVariables).
 *  - Moroccan aggregator (e.g. a local A2P SMS gateway with an ANRT-registered sender ID): usually a simple HTTPS GET/POST
 *                      with api key, sender, msisdn (212…), message. Cheaper and better deliverability on Maroc Telecom /
 *                      Orange / inwi than international routes.
 * Implement `OtpSender` below and return it from `getOtpSender()`.
 */

export type OtpChannel = "sms" | "whatsapp";

export interface OtpSender {
  readonly name: string;
  send(phone: string, code: string, channel: OtpChannel): Promise<{ delivered: boolean; devCode?: string }>;
}

/** Delivers nothing and hands the code back so the UI can show it (test mode). */
export const mockOtpSender: OtpSender = {
  name: "mock",
  async send(_phone, code) {
    return { delivered: false, devCode: code };
  },
};

export function getOtpSender(): OtpSender {
  switch (process.env.SMS_PROVIDER ?? "mock") {
    // case "twilio": return twilioOtpSender;
    // case "aggregator": return moroccanAggregatorOtpSender;
    default:
      return mockOtpSender;
  }
}

/**
 * Normalises a phone number to E.164.
 * Moroccan national formats (06…, 07…, 05…, 6…, 00212…, 212…) become +212XXXXXXXXX.
 * Returns null when the number is not plausible.
 */
export function normalizePhone(raw: string): string | null {
  let s = raw.replace(/[\s().-]/g, "");
  if (!s) return null;
  if (s.startsWith("00")) s = "+" + s.slice(2);
  if (/^0[5-7]\d{8}$/.test(s)) s = "+212" + s.slice(1);
  else if (/^[5-7]\d{8}$/.test(s)) s = "+212" + s;
  else if (/^212[5-7]\d{8}$/.test(s)) s = "+" + s;
  if (s.startsWith("+2120")) s = "+212" + s.slice(5);
  if (s.startsWith("+212")) return /^\+212[5-7]\d{8}$/.test(s) ? s : null;
  return /^\+[1-9]\d{7,14}$/.test(s) ? s : null;
}

