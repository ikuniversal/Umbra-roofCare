"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Eraser } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { PhotoUploader } from "@/components/inspections/photo-uploader";
import { completeJob } from "@/lib/jobs/actions";
import type { Job, Member, Property } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";

interface Props {
  job: Job;
  member: Pick<Member, "id" | "first_name" | "last_name"> | null;
  property: Pick<Property, "id" | "street" | "city" | "state"> | null;
  opcoId: string;
}

export function CompletionFlow({ job, member, property, opcoId }: Props) {
  const router = useRouter();
  const [photoUrls, setPhotoUrls] = React.useState<string[]>(
    job.completion_photo_urls ?? [],
  );
  const [notes, setNotes] = React.useState(job.completion_notes ?? "");
  const [finalAmount, setFinalAmount] = React.useState(
    job.final_cents ? (job.final_cents / 100).toString() : "",
  );
  const [signatureUrl, setSignatureUrl] = React.useState<string | null>(
    job.member_signature_url ?? null,
  );
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const address = property
    ? [property.street, property.city, property.state].filter(Boolean).join(", ")
    : "";

  const handlePhoto = (url: string) => {
    setPhotoUrls((prev) => [...prev, url]);
  };

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await completeJob({
        id: job.id,
        completion_notes: notes || null,
        completion_photo_urls: photoUrls,
        member_signature_url: signatureUrl ?? null,
        final_cents: finalAmount
          ? Math.round(Number(finalAmount) * 100)
          : null,
      });
      router.push(`/jobs/${job.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Completion failed");
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-brand-border bg-brand-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Link
            href={`/jobs/${job.id}`}
            className="flex items-center gap-1 text-sm text-brand-muted"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Link>
          <p className="label-mono">Complete job</p>
          <span className="w-14" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-6">
        <div>
          <p className="label-mono">
            {job.job_number ?? "Job"}
          </p>
          <h1 className="mt-1 font-serif text-3xl font-light text-brand-primary">
            {member ? `${member.first_name} ${member.last_name}` : "Job completion"}
          </h1>
          {address ? (
            <p className="mt-1 text-sm text-brand-muted">{address}</p>
          ) : null}
        </div>

        <section>
          <p className="label-mono mb-2">Completion photos</p>
          <PhotoUploader
            opcoId={opcoId}
            inspectionId={job.id}
            context="completion"
            onUploaded={handlePhoto}
            triggerLabel="Capture completion photo"
          />
          {photoUrls.length > 0 ? (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {photoUrls.map((url) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="h-24 w-32 shrink-0 overflow-hidden rounded-md border border-brand-border bg-brand-bg"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt="Completion"
                    className="h-full w-full object-cover"
                  />
                </a>
              ))}
            </div>
          ) : null}
        </section>

        <section className="space-y-2">
          <Label htmlFor="completion-notes">Completion notes</Label>
          <textarea
            id="completion-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Scope delivered, anything the next visit should know…"
            className="min-h-[120px] w-full rounded-md border border-brand-border-strong bg-brand-card px-3 py-2 text-sm text-brand-primary placeholder:text-brand-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30"
          />
        </section>

        <section className="space-y-2">
          <Label htmlFor="final">Final amount ($)</Label>
          <Input
            id="final"
            inputMode="decimal"
            value={finalAmount}
            onChange={(e) => setFinalAmount(e.target.value)}
          />
        </section>

        <SignaturePad
          opcoId={opcoId}
          jobId={job.id}
          value={signatureUrl}
          onChange={setSignatureUrl}
        />

        {error ? (
          <p className="rounded-md border border-brand-error/30 bg-brand-error/5 px-3 py-2 text-xs text-brand-error">
            {error}
          </p>
        ) : null}
      </main>

      <nav className="sticky bottom-0 border-t border-brand-border bg-brand-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <Link
            href={`/jobs/${job.id}`}
            className="flex-1 rounded-md border border-brand-border-strong bg-brand-card px-4 py-2 text-center text-sm text-brand-primary"
          >
            Cancel
          </Link>
          <Button
            variant="accent"
            className="flex-1"
            onClick={submit}
            disabled={saving}
          >
            {saving ? "Completing…" : "Complete job"}
          </Button>
        </div>
      </nav>
    </div>
  );
}

function SignaturePad({
  opcoId,
  jobId,
  value,
  onChange,
}: {
  opcoId: string;
  jobId: string;
  value: string | null;
  onChange: (url: string | null) => void;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const drawingRef = React.useRef(false);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#1F2937";
  }, []);

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drawingRef.current = true;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const end = () => {
    drawingRef.current = false;
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onChange(null);
  };

  const saveSignature = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setUploading(true);
    setError(null);
    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/png"),
      );
      if (!blob) throw new Error("Could not serialize signature");

      const supabase = createClient();
      const path = `${opcoId}/${jobId}/signature-${Date.now()}.png`;
      const { error: upErr } = await supabase.storage
        .from("inspection-photos")
        .upload(path, blob, { contentType: "image/png", upsert: true });
      if (upErr) throw upErr;

      const { data: signed, error: signErr } = await supabase.storage
        .from("inspection-photos")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      if (signErr || !signed?.signedUrl) {
        throw signErr ?? new Error("Could not sign URL");
      }
      onChange(signed.signedUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Member signature</Label>
        <button
          type="button"
          onClick={clear}
          className="flex items-center gap-1 text-xs text-brand-muted hover:text-brand-primary"
        >
          <Eraser className="h-3 w-3" />
          Clear
        </button>
      </div>
      <div className="rounded-md border border-brand-border-strong bg-brand-card">
        <canvas
          ref={canvasRef}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          className="h-40 w-full touch-none"
        />
      </div>
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-brand-faint">
          Sign above and save before completing.
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={saveSignature}
          disabled={uploading}
        >
          {uploading ? "Saving…" : value ? "Update signature" : "Save signature"}
        </Button>
      </div>
      {error ? (
        <p className="text-xs text-brand-error">{error}</p>
      ) : null}
      {value ? (
        <p className="text-xs text-brand-success">Signature captured.</p>
      ) : null}
    </section>
  );
}
