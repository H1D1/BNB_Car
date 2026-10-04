import "server-only";
import type { DocType } from "../types";

/**
 * Identity / driving-licence verification (OCR + authenticity checks).
 *
 * MOCK PROVIDER: there is no OCR yet, so we "extract" the number and expiry the user typed (simulated OCR) and
 * validate their formats. To go live, implement `KycProvider` with a real vendor and return it from `getKycProvider()`
 * (select with `KYC_PROVIDER`):
 *  - Document OCR + liveness: Onfido, Veriff, Sumsub, Jumio, IDnow — all support the Moroccan CIN (new electronic
 *    format) and passports; send the signed URLs of `front_path` / `back_path` from the private `verification-docs`
 *    bucket (createSignedUrl, short expiry) and map their decision/rejection codes onto `KycResult`.
 *  - Moroccan licence: the vendors' generic driving-licence model, or a manual review queue as a fallback
 *    (return status "pending" — the DB enum supports it).
 * The provider's raw response is stored in `verification_documents.provider_result`.
 */

export type KycReason = "expired" | "bad_number" | "unreadable" | "too_new";

export type KycInput = {
  docType: DocType;
  /** Storage paths in the private verification-docs bucket. */
  frontPath: string;
  backPath?: string | null;
  /** What the user typed — the mock treats it as the OCR output. */
  number?: string;
  expiresOn?: string; // YYYY-MM-DD
  fullName?: string;
};

export type KycResult = {
  status: "verified" | "rejected";
  reason?: KycReason;
  extracted: { number?: string; expiresOn?: string; fullName?: string };
};

export interface KycProvider {
  readonly name: string;
  verify(input: KycInput): Promise<KycResult>;
}

const PATTERNS: Record<DocType, (n: string) => boolean> = {
  cin: (n) => /^[A-Z]{1,2}\d{4,7}$/.test(n),
  passport: (n) => /^[A-Z0-9]{6,9}$/.test(n),
  license_ma: (n) => /^\d{1,2}[/-]?\d{4,8}$/.test(n),
  license_intl: (n) => n.length >= 5,
};

export const normalizeDocNumber = (raw: string | undefined) => (raw ?? "").toUpperCase().replace(/\s+/g, "").slice(0, 40);

export const mockKycProvider: KycProvider = {
  name: "mock",
  async verify(input) {
    const number = normalizeDocNumber(input.number);
    const expiresOn = input.expiresOn && /^\d{4}-\d{2}-\d{2}$/.test(input.expiresOn) ? input.expiresOn : undefined;
    const extracted = { number: number || undefined, expiresOn, fullName: input.fullName || undefined };
    // simulate a short OCR round-trip
    await new Promise((r) => setTimeout(r, 600));
    if (!input.frontPath || !number || !expiresOn) return { status: "rejected", reason: "unreadable", extracted };
    if (!PATTERNS[input.docType](number)) return { status: "rejected", reason: "bad_number", extracted };
    const today = new Date().toISOString().slice(0, 10);
    if (expiresOn <= today) return { status: "rejected", reason: "expired", extracted };
    return { status: "verified", extracted };
  },
};

export function getKycProvider(): KycProvider {
  switch (process.env.KYC_PROVIDER ?? "mock") {
    // case "onfido": return onfidoProvider;
    default:
      return mockKycProvider;
  }
}
