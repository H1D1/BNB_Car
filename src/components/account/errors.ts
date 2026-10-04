import type { TFn, TKey } from "@/lib/i18n/config";
import { errorText } from "@/lib/errors";

/** Server-action error code → message: `account.*` / `verification.*` first, then `errors.*`. */
export function accountError(t: TFn, code: string, ns: "account" | "verification" = "account") {
  const key = `${ns}.${code}` as TKey;
  const out = t(key);
  return out === key ? errorText(t, code) : out;
}
