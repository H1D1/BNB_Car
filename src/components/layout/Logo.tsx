import Link from "next/link";

export function Logo({ label }: { label: string }) {
  return (
    <Link href="/" className="group flex items-center gap-2.5" aria-label={label}>
      <span className="relative grid size-10 place-items-center rounded-2xl bg-gradient-to-br from-majorelle-400 via-majorelle-500 to-terracotta-500 shadow-[0_6px_20px_-4px_rgba(96,80,220,0.8)] transition-transform duration-500 ease-[var(--ease-liquid)] group-hover:rotate-[22.5deg]">
        {/* Khatam (8-point star) — a nod to zellige */}
        <svg viewBox="0 0 24 24" className="size-6 text-snow" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
          <rect x="5.5" y="5.5" width="13" height="13" rx="1" />
          <rect x="5.5" y="5.5" width="13" height="13" rx="1" transform="rotate(45 12 12)" />
          <circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none" />
        </svg>
      </span>
      <span className="leading-none">
        <span className="block text-[17px] font-bold tracking-tight">CarShare</span>
        <span className="block text-[11px] font-semibold tracking-[0.28em] text-saffron-300 uppercase">Morocco</span>
      </span>
    </Link>
  );
}
