import { AccountNav } from "@/components/account/AccountNav";

export default function AccountLayout({ children }: LayoutProps<"/account">) {
  return (
    <div className="mx-auto max-w-5xl px-4 pt-8 pb-16 md:px-6">
      <AccountNav />
      {children}
    </div>
  );
}
