"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/compress-image";
import { setAvatar } from "@/app/actions/account";
import { errorText } from "@/lib/errors";
import { Avatar } from "../ui/primitives";

export function AvatarUpload({ userId, name, url }: { userId: string; name: string; url: string | null }) {
  const { t } = useI18n();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const onFile = (file: File | undefined) => {
    if (!file) return;
    setError(null);
    start(async () => {
      try {
        const blob = await compressImage(file, 800);
        setPreview(URL.createObjectURL(blob));
        const path = `${userId}/avatar-${Date.now()}.jpg`;
        const { error: upErr } = await createClient().storage.from("avatars").upload(path, blob, { contentType: "image/jpeg" });
        if (upErr) throw upErr;
        const res = await setAvatar(path);
        if (res?.error) throw new Error(res.error);
        router.refresh();
      } catch {
        setPreview(null);
        setError(errorText(t, "generic"));
      }
    });
  };

  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- local blob preview
          <img src={preview} alt={name} className="size-20 rounded-full object-cover ring-2 ring-white/20" />
        ) : (
          <Avatar name={name} url={url} size={80} />
        )}
        {pending && (
          <span className="absolute inset-0 grid place-items-center rounded-full bg-ink-950/60">
            <Loader2 className="size-5 animate-spin" />
          </span>
        )}
      </div>
      <div>
        <p className="label mb-1">{t("account.avatar")}</p>
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={pending}
          className="glass inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-semibold transition hover:bg-white/15 disabled:opacity-50"
        >
          <Camera className="size-4" />
          {t("account.changeAvatar")}
        </button>
        <input ref={input} type="file" accept="image/*" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
        {error && <p className="mt-1.5 text-xs text-rose-400">{error}</p>}
      </div>
    </div>
  );
}
