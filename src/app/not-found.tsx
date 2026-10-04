import { Compass } from "lucide-react";
import { getI18n } from "@/lib/i18n/server";
import { ButtonLink } from "@/components/ui/Button";

export default async function NotFound() {
  const { t } = await getI18n();
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center px-4 text-center">
      <span className="glass grid size-20 place-items-center rounded-3xl text-saffron-300">
        <Compass className="size-10" />
      </span>
      <h1 className="mt-6 text-4xl font-bold">404 — {t("common.notFound")}</h1>
      <p className="mt-2 text-white/60">{t("common.notFoundText")}</p>
      <ButtonLink href="/" className="mt-8">
        {t("common.goHome")}
      </ButtonLink>
    </div>
  );
}
