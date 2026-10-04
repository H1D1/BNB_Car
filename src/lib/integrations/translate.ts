import "server-only";

/**
 * Message translation (French / Arabic & Darija / English).
 *
 * MOCK: returns null, and the chat shows `messages.translationOff`. To go live implement `Translator` with e.g.
 * Google Cloud Translation (v3, supports "ar" and auto-detection), DeepL (fr/en/ar), Azure Translator, or an LLM
 * prompt that handles Darija written in Latin script ("Arabizi") — and return it from `getTranslator()`
 * (select with `TRANSLATE_PROVIDER`). Results are cached in `messages.translations` by the server action.
 */

export type TranslateTarget = "fr" | "ar" | "en";

export interface Translator {
  readonly name: string;
  translate(text: string, target: TranslateTarget): Promise<string | null>;
}

export const mockTranslator: Translator = {
  name: "mock",
  async translate() {
    return null;
  },
};

export function getTranslator(): Translator {
  switch (process.env.TRANSLATE_PROVIDER ?? "mock") {
    // case "google": return googleTranslator;
    default:
      return mockTranslator;
  }
}
