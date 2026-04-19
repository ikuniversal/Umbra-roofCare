"use client";

import * as React from "react";
import imageCompression from "browser-image-compression";
import { Camera, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

interface PhotoUploaderProps {
  opcoId: string;
  inspectionId: string;
  context: string; // e.g. checkpoint id or "finding"
  onUploaded: (signedUrl: string, path: string) => Promise<void> | void;
  triggerLabel?: string;
  useCamera?: boolean;
}

interface UploadItem {
  id: string;
  name: string;
  progress: "compressing" | "uploading" | "done" | "error";
  error?: string;
}

const BUCKET = "inspection-photos";

export function PhotoUploader({
  opcoId,
  inspectionId,
  context,
  onUploaded,
  triggerLabel = "Add photo",
  useCamera = true,
}: PhotoUploaderProps) {
  const [items, setItems] = React.useState<UploadItem[]>([]);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const sessionIdRef = React.useRef(0);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const supabase = createClient();
    for (const file of Array.from(files)) {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const name = file.name || `photo-${id}.jpg`;
      setItems((p) => [...p, { id, name, progress: "compressing" }]);

      try {
        const compressed = await imageCompression(file, {
          maxSizeMB: 0.5,
          maxWidthOrHeight: 1920,
          useWebWorker: true,
        });
        setItems((p) =>
          p.map((it) =>
            it.id === id ? { ...it, progress: "uploading" } : it,
          ),
        );
        const ext = name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${opcoId}/${inspectionId}/${context}/${id}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(path, compressed, {
            contentType: compressed.type || "image/jpeg",
            upsert: false,
          });
        if (uploadError) throw uploadError;

        const { data: signed, error: signedErr } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(path, 60 * 60 * 24 * 7);
        if (signedErr || !signed?.signedUrl) {
          throw signedErr ?? new Error("Could not sign photo URL");
        }

        await onUploaded(signed.signedUrl, path);
        setItems((p) =>
          p.map((it) => (it.id === id ? { ...it, progress: "done" } : it)),
        );
      } catch (err) {
        console.error("[photo-upload] failed", err);
        setItems((p) =>
          p.map((it) =>
            it.id === id
              ? {
                  ...it,
                  progress: "error",
                  error: err instanceof Error ? err.message : "Upload failed",
                }
              : it,
          ),
        );
      }
    }

    if (inputRef.current) inputRef.current.value = "";
    sessionIdRef.current += 1;
  };

  const pendingCount = items.filter(
    (it) => it.progress !== "done" && it.progress !== "error",
  ).length;
  const errorItems = items.filter((it) => it.progress === "error");

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          {...(useCamera ? { capture: "environment" as const } : {})}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          onClick={() => inputRef.current?.click()}
        >
          {useCamera ? (
            <Camera className="h-4 w-4" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          {triggerLabel}
        </Button>
        {pendingCount > 0 ? (
          <span className="flex items-center gap-1 text-xs text-brand-muted">
            <Loader2 className="h-3 w-3 animate-spin" />
            {pendingCount} uploading
          </span>
        ) : null}
      </div>
      {items.length > 0 ? (
        <ul className="space-y-1 text-[11px] text-brand-muted">
          {items.map((it) => (
            <li key={it.id} className="flex items-center justify-between">
              <span className="truncate pr-2">{it.name}</span>
              <span
                className={
                  it.progress === "error"
                    ? "text-brand-error"
                    : it.progress === "done"
                      ? "text-brand-success"
                      : "text-brand-muted"
                }
              >
                {it.progress === "compressing"
                  ? "Compressing…"
                  : it.progress === "uploading"
                    ? "Uploading…"
                    : it.progress === "done"
                      ? "Uploaded"
                      : "Retry"}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {errorItems.length > 0 ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => inputRef.current?.click()}
        >
          Retry failed uploads ({errorItems.length})
        </Button>
      ) : null}
    </div>
  );
}
