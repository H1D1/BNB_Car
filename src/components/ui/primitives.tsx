import Image from "next/image";
import { AlertCircle, CheckCircle2, Info, Star } from "lucide-react";
import { cn, initials } from "@/lib/utils";

export function Glass({
  as: Tag = "div",
  strong,
  liquid,
  className,
  ...props
}: { as?: "div" | "section" | "article" | "aside"; strong?: boolean; liquid?: boolean } & React.HTMLAttributes<HTMLElement>) {
  return <Tag className={cn(strong ? "glass-strong" : "glass", liquid && "liquid", "rounded-[var(--radius-glass)]", className)} {...props} />;
}

const badgeTones = {
  neutral: "bg-white/10 text-white/80 border-white/15",
  majorelle: "bg-majorelle-500/20 text-majorelle-300 border-majorelle-400/30",
  saffron: "bg-saffron-500/15 text-saffron-300 border-saffron-400/30",
  terracotta: "bg-terracotta-500/15 text-terracotta-300 border-terracotta-400/30",
  mint: "bg-mint-500/15 text-mint-400 border-mint-400/30",
  rose: "bg-rose-500/15 text-rose-400 border-rose-400/30",
};
export type BadgeTone = keyof typeof badgeTones;

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap", badgeTones[tone], className)}>
      {children}
    </span>
  );
}

export function Stars({ value, size = 14, className }: { value: number; size?: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-label={`${value} / 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          style={{ width: size, height: size }}
          className={i <= Math.round(value) ? "fill-saffron-400 text-saffron-400" : "text-white/25"}
        />
      ))}
    </span>
  );
}

export function Rating({ value, count, className }: { value: number | null; count?: number; className?: string }) {
  if (value == null) return null;
  return (
    <span className={cn("inline-flex items-center gap-1 text-sm font-semibold", className)}>
      <Star className="size-3.5 fill-saffron-400 text-saffron-400" />
      {Number(value).toFixed(1)}
      {count != null && <span className="font-normal text-white/50">({count})</span>}
    </span>
  );
}

export function Avatar({ name, url, size = 40, className }: { name: string; url?: string | null; size?: number; className?: string }) {
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-terracotta-400 to-majorelle-500 font-bold text-white ring-2 ring-white/20",
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {url ? <Image src={url} alt={name} fill sizes={`${size}px`} className="object-cover" /> : initials(name || "?")}
    </span>
  );
}

const alertTones = {
  error: { cls: "border-rose-400/40 bg-rose-500/10 text-rose-200", Icon: AlertCircle },
  success: { cls: "border-mint-400/40 bg-mint-500/10 text-mint-400", Icon: CheckCircle2 },
  info: { cls: "border-majorelle-400/40 bg-majorelle-500/10 text-majorelle-300", Icon: Info },
  warning: { cls: "border-saffron-400/40 bg-saffron-500/10 text-saffron-300", Icon: AlertCircle },
};

export function Alert({
  tone = "info",
  className,
  children,
}: {
  tone?: keyof typeof alertTones;
  className?: string;
  children: React.ReactNode;
}) {
  const { cls, Icon } = alertTones[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm", cls, className)}>
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  text,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  text?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("glass flex flex-col items-center rounded-[var(--radius-glass)] px-6 py-14 text-center", className)}>
      {icon && <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-white/10 text-saffron-300">{icon}</div>}
      <h3 className="text-lg font-bold">{title}</h3>
      {text && <p className="mt-1 max-w-md text-sm text-white/60">{text}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{title}</h1>
        {subtitle && <p className="mt-2 max-w-2xl text-white/60">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Field({
  label,
  hint,
  error,
  htmlFor,
  className,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="label">
        {label}
      </label>
      {children}
      {error ? <p className="mt-1.5 text-xs text-rose-400">{error}</p> : hint ? <p className="mt-1.5 text-xs text-white/45">{hint}</p> : null}
    </div>
  );
}

export function Toggle({
  name,
  defaultChecked,
  checked,
  onChange,
  label,
  description,
}: {
  name?: string;
  defaultChecked?: boolean;
  checked?: boolean;
  onChange?: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="glass-subtle flex cursor-pointer items-start justify-between gap-4 rounded-2xl p-4 transition hover:bg-white/[0.08]">
      <span>
        <span className="block font-semibold">{label}</span>
        {description && <span className="mt-0.5 block text-sm text-white/55">{description}</span>}
      </span>
      <span className="relative mt-0.5 shrink-0">
        <input
          type="checkbox"
          name={name}
          value="on"
          defaultChecked={defaultChecked}
          checked={checked}
          onChange={onChange ? (e) => onChange(e.target.checked) : undefined}
          className="peer sr-only"
        />
        <span className="block h-6 w-11 rounded-full bg-white/15 transition peer-checked:bg-majorelle-500" />
        <span className="absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform duration-300 ease-[var(--ease-liquid)] peer-checked:translate-x-5 rtl:peer-checked:-translate-x-5 rtl:right-0.5 rtl:left-auto" />
      </span>
    </label>
  );
}
