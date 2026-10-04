import type { Metadata, Viewport } from "next";
import { Questrial, Tajawal } from "next/font/google";
import "./globals.css";
import { getCurrency, getI18n } from "@/lib/i18n/server";
import { I18nProvider } from "@/lib/i18n/client";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { LiquidPointer } from "@/components/ui/LiquidPointer";
import { themeInitScript } from "@/lib/theme-shared";
import { InlineScript } from "@/components/ui/InlineScript";

// Century Gothic is used when installed; Questrial is the closest open geometric fallback.
const geo = Questrial({ weight: "400", subsets: ["latin"], variable: "--font-geo", display: "swap" });
const tajawal = Tajawal({ weight: ["400", "500", "700"], subsets: ["arabic"], variable: "--font-tajawal", display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
    title: { default: `${t("common.appName")} — ${t("common.tagline")}`, template: `%s · ${t("common.appName")}` },
    description: t("home.subtitle"),
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f2ec" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0f2c" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { locale, dir, dict } = await getI18n();
  const currency = await getCurrency();
  return (
    // The theme class is applied by the inline script (and ThemeToggle), never by React.
    <html lang={locale} dir={dir} className={`${geo.variable} ${tajawal.variable} antialiased`} suppressHydrationWarning>
      <head>
        <InlineScript html={themeInitScript} />
      </head>
      <body className="flex min-h-dvh flex-col">
        <div className="atmosphere" aria-hidden>
          <div className="blob start-[-10%] top-[10%] size-[40vw] bg-majorelle-500/50" />
          <div className="blob end-[-5%] top-[45%] size-[35vw] bg-terracotta-500/40 [animation-delay:-5s]" />
          <div className="blob start-[30%] bottom-[-15%] size-[30vw] bg-saffron-500/20 [animation-delay:-9s]" />
          <div className="zellige" />
        </div>
        <I18nProvider locale={locale} currency={currency} dict={dict}>
          <LiquidPointer />
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </I18nProvider>
      </body>
    </html>
  );
}
