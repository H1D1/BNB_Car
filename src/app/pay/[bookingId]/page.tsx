import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getI18n } from "@/lib/i18n/server";
import { createClient, getUser } from "@/lib/supabase/server";
import { PaymentForm } from "@/components/booking/PaymentForm";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t("pay.title") };
}

export default async function PayPage(props: PageProps<"/pay/[bookingId]">) {
  const { bookingId } = await props.params;
  const user = await getUser();
  if (!user) redirect(`/login?next=/pay/${bookingId}`);
  const supabase = await createClient();
  const { data: b } = await supabase
    .from("bookings")
    .select("id, reference, renter_id, status, payment_status, payment_method, total_mad, deposit_mad, car:cars(make, model, year)")
    .eq("id", bookingId)
    .maybeSingle();
  if (!b || b.renter_id !== user.id) notFound();
  if (b.payment_status === "paid" || b.payment_method === "cash" || b.status !== "confirmed") redirect(`/trips/${bookingId}`);
  const car = b.car as unknown as { make: string; model: string; year: number } | null;

  return (
    <div className="flex min-h-[75dvh] items-center justify-center px-4 py-12">
      <PaymentForm
        bookingId={b.id}
        reference={b.reference}
        method={b.payment_method as "cmi" | "card"}
        total={Number(b.total_mad)}
        deposit={Number(b.deposit_mad)}
        description={car ? `${car.make} ${car.model} ${car.year}` : ""}
      />
    </div>
  );
}
