"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { Armchair, Camera, CarFront, Check, ChevronLeft, ChevronRight, Gauge, ImagePlus, Loader2, Star, Trash2, X } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { createClient } from "@/lib/supabase/client";
import { errorText } from "@/lib/errors";
import { addCarPhotos, deletePhoto, reorderPhotos, setPhotoKind } from "@/app/actions/host";
import { MIN_PHOTOS, PHOTO_KINDS } from "@/lib/listing";
import { cn } from "@/lib/utils";
import { Alert, Badge, Field } from "@/components/ui/primitives";
import type { CarPhoto, Locale, PhotoKind } from "@/lib/types";
import { Section } from "./ui";
import type { StepProps } from "./values";

type Upload = { id: string; name: string; progress: number; state: "compressing" | "uploading" | "done" | "error" };

const MAX_SIDE = 1600;

/** Resize to ≤1600px and re-encode as JPEG — keeps uploads small on mobile networks. */
async function compress(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", 0.82));
}

/** Storage upload via XHR so we get byte-level progress (supabase-js doesn't expose it). */
function uploadWithProgress(path: string, blob: Blob, token: string, onProgress: (p: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/car-photos/${path.split("/").map(encodeURIComponent).join("/")}`;
    xhr.open("POST", url);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("apikey", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    xhr.setRequestHeader("Content-Type", blob.type || "image/jpeg");
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("cache-control", "max-age=31536000");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(xhr.responseText)));
    xhr.onerror = () => reject(new Error("network"));
    xhr.send(blob);
  });
}

/** Storage path — first folder must be the owner's uid (bucket RLS). */
const photoPath = (userId: string, carId: string, i: number) => `${userId}/${carId}/${Date.now()}-${i}.jpg`;
const batchId = (i: number) => `${Date.now()}-${i}`;

const PROMPTS: { kind: Exclude<PhotoKind, "other">; Icon: typeof Camera }[] = [
  { kind: "exterior", Icon: CarFront },
  { kind: "interior", Icon: Armchair },
  { kind: "odometer", Icon: Gauge },
];

export function PhotosStep({
  v,
  set,
  invalid,
  carId,
  userId,
  photos,
  setPhotos,
  verified,
}: StepProps & {
  carId: string;
  userId: string;
  photos: CarPhoto[];
  setPhotos: (p: CarPhoto[]) => void;
  verified: boolean;
}) {
  const { t } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const kindRef = useRef<PhotoKind>("exterior");
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, startBusy] = useTransition();

  const choose = (kind: PhotoKind) => {
    kindRef.current = kind;
    input.current?.click();
  };

  const patchUpload = (id: string, p: Partial<Upload>) => setUploads((u) => u.map((x) => (x.id === id ? { ...x, ...p } : x)));

  const handleFiles = async (files: File[], kind: PhotoKind) => {
    const images = files.filter((f) => f.type.startsWith("image/")).slice(0, 20);
    if (!images.length) return;
    setError(null);
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return setError(errorText(t, "not_authenticated"));

    const batch = images.map((file, i) => ({ id: batchId(i), file }));
    setUploads((u) => [
      ...u.filter((x) => x.state !== "done"),
      ...batch.map((b) => ({ id: b.id, name: b.file.name, progress: 0, state: "compressing" as const })),
    ]);

    // One at a time: friendlier to slow / metered connections than parallel uploads.
    for (const [i, item] of batch.entries()) {
      try {
        const blob = await compress(item.file);
        patchUpload(item.id, { state: "uploading" });
        const path = photoPath(userId, carId, i);
        await uploadWithProgress(path, blob, token, (p) => patchUpload(item.id, { progress: p }));
        const res = await addCarPhotos(carId, [{ path, kind }]);
        if (res.error || !res.photos) throw new Error(res.error);
        setPhotos(res.photos);
        patchUpload(item.id, { state: "done", progress: 1 });
      } catch {
        patchUpload(item.id, { state: "error" });
        setError(t("wizard.uploadFailed"));
      }
    }
  };

  const apply = (p: Promise<{ error?: string; photos?: CarPhoto[] }>) =>
    startBusy(async () => {
      const res = await p;
      if (res.photos) setPhotos(res.photos);
      if (res.error) setError(errorText(t, res.error));
    });

  const move = (index: number, to: number) => {
    if (to < 0 || to >= photos.length) return;
    const next = [...photos];
    const [item] = next.splice(index, 1);
    next.splice(to, 0, item);
    setPhotos(next.map((p, i) => ({ ...p, position: i })));
    apply(reorderPhotos(carId, next.map((p) => p.id)));
  };

  const remove = (photo: CarPhoto) => {
    if (!window.confirm(t("wizard.deletePhotoConfirm"))) return;
    setPhotos(photos.filter((p) => p.id !== photo.id));
    apply(deletePhoto(carId, photo.id));
  };

  const hasDescription = Object.values(v.description).some((s) => s.trim().length > 0);
  const checks = [
    { ok: photos.length >= MIN_PHOTOS, label: t("wizard.needPhotos") },
    { ok: hasDescription, label: t("wizard.needDescription") },
    { ok: verified, label: t("wizard.needVerification"), link: "/account/verification" },
  ];

  return (
    <div className="space-y-10">
      <Section title={t("wizard.photosTitle")} hint={t("wizard.photosHint")}>
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          multiple
          hidden
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            handleFiles(files, kindRef.current);
          }}
        />
        <div className="grid gap-3 sm:grid-cols-3">
          {PROMPTS.map(({ kind, Icon }) => {
            const count = photos.filter((p) => p.kind === kind).length;
            return (
              <button
                key={kind}
                type="button"
                onClick={() => choose(kind)}
                className={cn(
                  "glass-subtle flex items-start gap-3 rounded-2xl p-4 text-start transition hover:bg-white/[0.08]",
                  count > 0 && "border-mint-400/40",
                )}
              >
                <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl", count > 0 ? "bg-mint-500/20 text-mint-400" : "bg-white/10 text-saffron-300")}>
                  {count > 0 ? <Check className="size-5" /> : <Icon className="size-5" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{t(`wizard.prompts.${kind}`)}</span>
                  <span className="mt-1 inline-flex items-center gap-1 text-xs text-white/55">
                    <Camera className="size-3.5" />
                    {count > 0 ? t("wizard.photoCount", { count }) : t("wizard.addPhotos")}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            handleFiles(Array.from(e.dataTransfer.files), "exterior");
          }}
          className={cn(
            "flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition",
            dragging ? "border-saffron-300/70 bg-saffron-500/10" : "border-white/15 bg-white/[0.03]",
          )}
        >
          <ImagePlus className="size-8 text-white/50" />
          <button type="button" onClick={() => choose("exterior")} className="font-semibold text-saffron-300 hover:underline">
            {t("wizard.addPhotos")}
          </button>
          <p className="text-xs text-white/45">{t("wizard.dropHint")}</p>
        </div>

        {uploads.length > 0 && (
          <ul className="space-y-2">
            {uploads.map((u) => (
              <li key={u.id} className="glass-subtle flex items-center gap-3 rounded-xl px-3 py-2 text-sm">
                {u.state === "done" ? (
                  <Check className="size-4 shrink-0 text-mint-400" />
                ) : u.state === "error" ? (
                  <X className="size-4 shrink-0 text-rose-400" />
                ) : (
                  <Loader2 className="size-4 shrink-0 animate-spin text-white/60" />
                )}
                <span className="min-w-0 flex-1 truncate">{u.name}</span>
                <span className="h-1.5 w-28 overflow-hidden rounded-full bg-white/10">
                  <span
                    className={cn("block h-full rounded-full transition-all", u.state === "error" ? "bg-rose-400" : "bg-gradient-to-r from-majorelle-400 to-saffron-300")}
                    style={{ width: `${Math.round((u.state === "compressing" ? 0.05 : u.progress) * 100)}%` }}
                  />
                </span>
              </li>
            ))}
          </ul>
        )}

        {error && <Alert tone="error">{error}</Alert>}

        {photos.length > 0 && (
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {photos.map((p, i) => (
              <li key={p.id} className="glass-subtle overflow-hidden rounded-2xl">
                <div className="relative aspect-[4/3]">
                  <Image src={p.url} alt="" fill sizes="(max-width: 768px) 50vw, 33vw" className="object-cover" />
                  {i === 0 && (
                    <Badge tone="saffron" className="absolute start-2 top-2 backdrop-blur-md">
                      <Star className="size-3" />
                      {t("wizard.cover")}
                    </Badge>
                  )}
                  <button
                    type="button"
                    onClick={() => remove(p)}
                    aria-label={t("common.delete")}
                    className="absolute end-2 top-2 grid size-8 place-items-center rounded-full bg-ink-950/70 text-snow/80 backdrop-blur-md transition hover:bg-rose-500 hover:text-white"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
                <div className="space-y-2 p-2.5">
                  <select
                    value={p.kind}
                    aria-label={t("wizard.photoKindLabel")}
                    onChange={(e) => {
                      const kind = e.target.value as PhotoKind;
                      setPhotos(photos.map((x) => (x.id === p.id ? { ...x, kind } : x)));
                      apply(setPhotoKind(carId, p.id, kind));
                    }}
                    className="field h-9 py-0 text-sm"
                  >
                    {PHOTO_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {t(`wizard.photoKind.${k}`)}
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => move(i, i - 1)}
                      disabled={i === 0 || busy}
                      aria-label={t("wizard.moveEarlier")}
                      className="grid size-8 place-items-center rounded-full bg-white/8 transition hover:bg-white/15 disabled:opacity-30"
                    >
                      <ChevronLeft className="size-4 rtl:rotate-180" />
                    </button>
                    <button
                      type="button"
                      onClick={() => move(i, i + 1)}
                      disabled={i === photos.length - 1 || busy}
                      aria-label={t("wizard.moveLater")}
                      className="grid size-8 place-items-center rounded-full bg-white/8 transition hover:bg-white/15 disabled:opacity-30"
                    >
                      <ChevronRight className="size-4 rtl:rotate-180" />
                    </button>
                    {i > 0 && (
                      <button
                        type="button"
                        onClick={() => move(i, 0)}
                        disabled={busy}
                        className="ms-auto rounded-full px-2.5 py-1 text-xs font-semibold text-saffron-300 transition hover:bg-white/10"
                      >
                        {t("wizard.makeCover")}
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={t("wizard.descriptionTitle")} hint={t("wizard.descriptionHint")}>
        <Field label={t("wizard.title")} htmlFor="title">
          <input
            id="title"
            value={v.title}
            maxLength={80}
            placeholder={`${v.make} ${v.model} ${v.year}`.trim()}
            onChange={(e) => set({ title: e.target.value })}
            aria-invalid={invalid("title")}
            className="field"
          />
        </Field>
        <div className="grid gap-4 lg:grid-cols-3">
          {(["fr", "ar", "en"] as Locale[]).map((l) => (
            <Field key={l} label={t(`wizard.descLang.${l}`)} htmlFor={`desc-${l}`}>
              <textarea
                id={`desc-${l}`}
                lang={l}
                dir={l === "ar" ? "rtl" : "ltr"}
                rows={7}
                maxLength={3000}
                value={v.description[l]}
                onChange={(e) => {
                  const text = e.target.value;
                  set((p) => ({ description: { ...p.description, [l]: text } }));
                }}
                aria-invalid={invalid("description")}
                className="field min-h-40 resize-y py-3 leading-relaxed"
              />
            </Field>
          ))}
        </div>
      </Section>

      <ul className="glass-subtle grid gap-2 rounded-2xl p-4 sm:grid-cols-3">
        {checks.map((c) => (
          <li key={c.label} className="flex items-start gap-2 text-sm">
            <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full", c.ok ? "bg-mint-500/25 text-mint-400" : "bg-white/10 text-white/40")}>
              <Check className="size-3.5" />
            </span>
            <span className={c.ok ? "text-white/50 line-through" : "text-white/80"}>
              {c.label}
              {!c.ok && c.link && (
                <Link href={c.link} className="ms-1.5 font-semibold text-saffron-300 hover:underline">
                  {t("wizard.verifyNow")}
                </Link>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
