import type { TFn, TKey } from "./i18n/config";

/** Translates an `errors.*` code returned by a server action, falling back to the generic message. */
export function errorText(t: TFn, code: string | undefined | null) {
  const key = `errors.${code ?? "generic"}` as TKey;
  const out = t(key);
  return out === key ? t("errors.generic") : out;
}

/** Like errorText, but also understands parameterised RPC codes such as "min_days_2". */
export function rpcErrorMessage(t: TFn, message: string | undefined | null) {
  const min = message ? /^min_days_(\d+)$/.exec(message) : null;
  if (min) return t("errors.min_days", { count: min[1] });
  return errorText(t, message);
}
