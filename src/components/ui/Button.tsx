import Link from "next/link";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "accent" | "danger" | "success";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap select-none transition-all duration-300 ease-[var(--ease-liquid)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-majorelle-400/40 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.97]";

const variants: Record<Variant, string> = {
  primary:
    "text-snow bg-gradient-to-br from-majorelle-400 to-majorelle-600 shadow-[0_8px_24px_-6px_rgba(96,80,220,0.7),inset_0_1px_0_rgba(255,255,255,0.3)] hover:shadow-[0_12px_32px_-6px_rgba(96,80,220,0.9),inset_0_1px_0_rgba(255,255,255,0.35)] hover:-translate-y-0.5",
  accent:
    "text-ink-950 bg-gradient-to-br from-saffron-400 to-terracotta-400 shadow-[0_8px_24px_-6px_rgba(226,114,91,0.6),inset_0_1px_0_rgba(255,255,255,0.5)] hover:-translate-y-0.5 hover:shadow-[0_12px_32px_-6px_rgba(226,114,91,0.8)]",
  secondary: "glass text-white hover:bg-white/15 hover:-translate-y-0.5",
  ghost: "text-white/80 hover:text-white hover:bg-white/10",
  danger: "text-snow bg-rose-500/80 hover:bg-rose-500 border border-rose-300/30",
  success: "text-ink-950 bg-mint-400 hover:bg-mint-500",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5 text-[15px]",
  lg: "h-13 px-7 text-base",
};

type Common = { variant?: Variant; size?: Size; className?: string; children: React.ReactNode };

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: Common & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={cn(base, variants[variant], sizes[size], className)} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  href,
  ...props
}: Common & { href: string } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  const external = /^https?:/.test(href);
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cn(base, variants[variant], sizes[size], className)} {...props} />
    );
  }
  return <Link href={href} className={cn(base, variants[variant], sizes[size], className)} {...props} />;
}
