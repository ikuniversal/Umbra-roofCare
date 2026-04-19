"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Loader2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PhotoUploader } from "@/components/inspections/photo-uploader";
import { FindingsList } from "@/components/inspections/findings-list";
import { ScoreDisplay } from "@/components/inspections/score-display";
import {
  addCheckpointPhoto,
  completeInspection,
  rateCheckpoint,
} from "@/lib/inspections/actions";
import { scoreInspection } from "@/lib/inspections/scoring";
import { CHECKPOINT_RATING_LABELS } from "@/lib/labels";
import type {
  CheckpointRating,
  CheckpointResult,
  InspectionFinding,
  Member,
  Property,
  TemplateCheckpoint,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { AddFindingButton } from "../add-finding-button";

interface Props {
  inspectionId: string;
  opcoId: string;
  member: Pick<Member, "id" | "first_name" | "last_name"> | null;
  property: Pick<Property, "id" | "street" | "city" | "state" | "zip"> | null;
  checkpoints: TemplateCheckpoint[];
  initialResults: CheckpointResult[];
  initialFindings: InspectionFinding[];
}

export function CaptureFlow({
  inspectionId,
  opcoId,
  member,
  property,
  checkpoints,
  initialResults,
  initialFindings,
}: Props) {
  const router = useRouter();
  const [results, setResults] = React.useState<CheckpointResult[]>(initialResults);
  const [index, setIndex] = React.useState(() => {
    const first = initialResults.findIndex((r) => r.rating === null);
    return first === -1 ? checkpoints.length : first;
  });
  const [showReview, setShowReview] = React.useState(index >= checkpoints.length);
  const [weather, setWeather] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [completing, setCompleting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const totalCheckpoints = checkpoints.length;
  const current = checkpoints[index];
  const currentResult = results.find(
    (r) => r.checkpoint_id === current?.id,
  );
  const answered = results.filter((r) => r.rating !== null).length;
  const breakdown = scoreInspection(checkpoints, results);
  const progressPct =
    totalCheckpoints === 0 ? 0 : Math.round((answered / totalCheckpoints) * 100);

  const address = property
    ? [property.street, property.city, property.state]
        .filter(Boolean)
        .join(", ")
    : "";

  const setRating = async (rating: CheckpointRating) => {
    if (!current) return;
    setError(null);
    const optimistic = results.map((r) =>
      r.checkpoint_id === current.id ? { ...r, rating } : r,
    );
    setResults(optimistic);
    setSaving(true);
    try {
      await rateCheckpoint({
        inspectionId,
        checkpointId: current.id,
        rating,
        notes: currentResult?.notes ?? "",
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save rating.");
    } finally {
      setSaving(false);
    }
  };

  const updateNotes = (notes: string) => {
    if (!current) return;
    setResults((prev) =>
      prev.map((r) =>
        r.checkpoint_id === current.id ? { ...r, notes } : r,
      ),
    );
  };

  const saveNotes = async () => {
    if (!current || !currentResult?.rating) return;
    try {
      await rateCheckpoint({
        inspectionId,
        checkpointId: current.id,
        rating: currentResult.rating,
        notes: currentResult.notes ?? "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save notes.");
    }
  };

  const handlePhoto = async (url: string) => {
    if (!current) return;
    setResults((prev) =>
      prev.map((r) =>
        r.checkpoint_id === current.id
          ? { ...r, photo_urls: [...r.photo_urls, url] }
          : r,
      ),
    );
    await addCheckpointPhoto({
      inspectionId,
      checkpointId: current.id,
      photoUrl: url,
    });
  };

  const next = () => {
    if (index + 1 >= totalCheckpoints) {
      setShowReview(true);
    } else {
      setIndex(index + 1);
    }
  };

  const prev = () => {
    if (showReview) {
      setShowReview(false);
      setIndex(totalCheckpoints - 1);
      return;
    }
    setIndex(Math.max(0, index - 1));
  };

  const complete = async () => {
    setError(null);
    setCompleting(true);
    try {
      await completeInspection({
        inspectionId,
        weather: weather || undefined,
      });
      router.push(`/inspections/${inspectionId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not complete.");
      setCompleting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-brand-border bg-brand-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <Link
            href={`/inspections/${inspectionId}`}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-brand-border bg-brand-card text-brand-muted"
            aria-label="Exit capture"
          >
            <X className="h-4 w-4" />
          </Link>
          <div className="min-w-0 flex-1 text-center">
            <p className="label-mono">
              {showReview
                ? "Review"
                : `Checkpoint ${Math.min(index + 1, totalCheckpoints)} of ${totalCheckpoints}`}
            </p>
            <p className="truncate font-serif text-sm text-brand-primary">
              {address || (member ? `${member.first_name} ${member.last_name}` : "Inspection")}
            </p>
          </div>
          <span className="text-xs text-brand-muted">
            {progressPct}%
          </span>
        </div>
        <div className="h-1 bg-brand-border">
          <div
            className="h-full bg-brand-accent transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </header>

      {showReview ? (
        <ReviewPanel
          inspectionId={inspectionId}
          checkpoints={checkpoints}
          results={results}
          weather={weather}
          setWeather={setWeather}
          findings={initialFindings}
          completing={completing}
          error={error}
          onBack={prev}
          onComplete={complete}
          score={breakdown.score}
          band={breakdown.band}
          action={breakdown.action}
          answered={answered}
        />
      ) : current ? (
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
          <Badge variant="primary" className="mb-3">
            {current.category}
          </Badge>
          <h1 className="font-serif text-3xl font-light text-brand-primary">
            {current.label}
          </h1>
          <p className="label-mono mt-1">Weight · {current.weight}</p>

          <div className="mt-6 grid grid-cols-3 gap-3">
            {(["pass", "warn", "fail"] as CheckpointRating[]).map((r) => {
              const active = currentResult?.rating === r;
              const palette =
                r === "pass"
                  ? active
                    ? "bg-brand-success text-white border-brand-success"
                    : "border-brand-success/40 text-brand-success hover:bg-brand-success/10"
                  : r === "warn"
                    ? active
                      ? "bg-brand-accent text-white border-brand-accent"
                      : "border-brand-accent/40 text-brand-accent hover:bg-brand-accent/10"
                    : active
                      ? "bg-brand-error text-white border-brand-error"
                      : "border-brand-error/40 text-brand-error hover:bg-brand-error/10";
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRating(r)}
                  disabled={saving}
                  className={cn(
                    "flex h-20 flex-col items-center justify-center gap-1 rounded-md border-2 font-serif text-xl transition-colors",
                    palette,
                  )}
                >
                  <span>{CHECKPOINT_RATING_LABELS[r]}</span>
                  <span className="text-[11px] font-medium uppercase tracking-wider opacity-80">
                    {r === "pass"
                      ? "Full points"
                      : r === "warn"
                        ? "Half points"
                        : "Zero"}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-6 space-y-3">
            <PhotoUploader
              opcoId={opcoId}
              inspectionId={inspectionId}
              context={current.id}
              onUploaded={handlePhoto}
              triggerLabel="Capture photo"
            />
            {currentResult?.photo_urls && currentResult.photo_urls.length > 0 ? (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {currentResult.photo_urls.map((url) => (
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
                      alt="Checkpoint"
                      className="h-full w-full object-cover"
                    />
                  </a>
                ))}
              </div>
            ) : null}
          </div>

          <details className="mt-6 rounded-md border border-brand-border bg-brand-card">
            <summary className="cursor-pointer px-4 py-3 text-sm text-brand-primary">
              Notes
            </summary>
            <div className="px-4 pb-4">
              <textarea
                value={currentResult?.notes ?? ""}
                onChange={(e) => updateNotes(e.target.value)}
                onBlur={saveNotes}
                placeholder="Conditions, context, what you saw…"
                className="min-h-[80px] w-full rounded-md border border-brand-border bg-brand-bg px-3 py-2 text-sm text-brand-primary placeholder:text-brand-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30"
              />
            </div>
          </details>

          {error ? (
            <p className="mt-4 text-xs text-brand-error">{error}</p>
          ) : null}
        </main>
      ) : null}

      {!showReview ? (
        <nav className="sticky bottom-0 border-t border-brand-border bg-brand-bg/95 backdrop-blur">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
            <Button
              variant="outline"
              onClick={prev}
              disabled={index === 0}
              className="flex-1"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="accent"
              onClick={next}
              disabled={!currentResult?.rating || saving}
              className="flex-1"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  {index + 1 === totalCheckpoints ? "Review" : "Next"}
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </nav>
      ) : null}
    </div>
  );
}

function ReviewPanel({
  inspectionId,
  checkpoints,
  results,
  weather,
  setWeather,
  findings,
  completing,
  error,
  onBack,
  onComplete,
  score,
  band,
  action,
  answered,
}: {
  inspectionId: string;
  checkpoints: TemplateCheckpoint[];
  results: CheckpointResult[];
  weather: string;
  setWeather: (v: string) => void;
  findings: InspectionFinding[];
  completing: boolean;
  error: string | null;
  onBack: () => void;
  onComplete: () => void;
  score: number;
  band: import("@/lib/types").ConditionBand;
  action: import("@/lib/types").RecommendedAction;
  answered: number;
}) {
  const unanswered = results.filter((r) => r.rating === null);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
      <h1 className="font-serif text-3xl font-light text-brand-primary">
        Review
      </h1>
      <p className="mt-1 text-sm text-brand-muted">
        {answered} of {checkpoints.length} checkpoints rated.
      </p>

      <div className="mt-6 rounded-md border border-brand-border bg-brand-card p-5">
        <div className="flex items-center justify-between gap-4">
          <ScoreDisplay score={score} band={band} action={action} size="md" />
          <div>
            <p className="label-mono">Status</p>
            <p className="mt-1 font-serif text-lg text-brand-primary">
              Ready to complete
            </p>
          </div>
        </div>
      </div>

      {unanswered.length > 0 ? (
        <div className="mt-4 rounded-md border border-brand-warn/30 bg-brand-warn/10 p-4 text-sm text-brand-warn">
          {unanswered.length} checkpoint{unanswered.length === 1 ? "" : "s"}{" "}
          still unrated. Scroll back to complete them before closing out.
        </div>
      ) : null}

      <div className="mt-6 space-y-4">
        <div>
          <div className="flex items-center justify-between">
            <p className="label-mono">Findings</p>
            <AddFindingButton inspectionId={inspectionId} />
          </div>
          <div className="mt-3">
            <FindingsList findings={findings} emptyMessage="No findings added yet." />
          </div>
        </div>

        <div>
          <p className="label-mono">Weather at inspection</p>
          <input
            value={weather}
            onChange={(e) => setWeather(e.target.value)}
            placeholder="Clear, 72°F"
            className="mt-2 h-10 w-full rounded-md border border-brand-border-strong bg-brand-card px-3 text-sm text-brand-primary placeholder:text-brand-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30"
          />
        </div>
      </div>

      {error ? (
        <p className="mt-4 text-xs text-brand-error">{error}</p>
      ) : null}

      <div className="sticky bottom-0 mt-8 flex gap-3 border-t border-brand-border bg-brand-bg/95 py-4 backdrop-blur">
        <Button variant="outline" onClick={onBack} className="flex-1">
          <ChevronLeft className="h-4 w-4" />
          Back
        </Button>
        <Button
          variant="accent"
          onClick={onComplete}
          disabled={completing || unanswered.length > 0}
          className="flex-1"
        >
          {completing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Complete inspection"
          )}
        </Button>
      </div>
    </main>
  );
}
