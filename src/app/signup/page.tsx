import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getI18n } from "@/lib/i18n/server";
import { getUser } from "@/lib/supabase/server";
import { AuthForm } from "@/components/auth/AuthForm";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("auth.signupTitle") };
}

export default async function Page(props: PageProps<"/signup">) {
  const { next, error } = await props.searchParams;
  const nextPath = typeof next === "string" ? next : undefined;
  if (await getUser()) redirect(nextPath ?? "/");
  return (
    <div className="flex min-h-[70dvh] items-center justify-center px-4 py-12">
      <AuthForm mode="signup" next={nextPath} oauthError={typeof error === "string" ? error : undefined} />
    </div>
  );
}
