import { CHECKPOINT_RATING_MULTIPLIER } from "@/lib/labels";
import type {
  CheckpointResult,
  ConditionBand,
  RecommendedAction,
  TemplateCheckpoint,
} from "@/lib/types";
import { groupCheckpointsByCategory } from "./template";

export interface ScoreBreakdown {
  score: number;
  band: ConditionBand;
  action: RecommendedAction;
  byCategory: Record<string, { score: number; weight: number }>;
  answered: number;
  total: number;
}

// Score is weighted sum of checkpoint weight × rating multiplier, normalized
// so a template with weights summing to 100 returns 0-100 directly. A
// partial capture is normalized against ANSWERED weight so a half-done
// inspection reads as its projected score, not an artificial zero.
export function scoreInspection(
  checkpoints: TemplateCheckpoint[],
  results: CheckpointResult[],
): ScoreBreakdown {
  const resultsById = new Map(results.map((r) => [r.checkpoint_id, r]));
  const byCategory: Record<string, { score: number; weight: number }> = {};

  let earned = 0;
  let answeredWeight = 0;
  let answered = 0;

  for (const cp of checkpoints) {
    const result = resultsById.get(cp.id);
    const rating = result?.rating ?? null;
    if (rating === null) continue;

    answered += 1;
    answeredWeight += cp.weight;
    const multiplier = CHECKPOINT_RATING_MULTIPLIER[rating];
    const points = cp.weight * multiplier;
    earned += points;

    const bucket = (byCategory[cp.category] ??= { score: 0, weight: 0 });
    bucket.score += points;
    bucket.weight += cp.weight;
  }

  // If nothing is scored yet we surface 0; otherwise normalize.
  const score =
    answeredWeight === 0 ? 0 : Math.round((earned / answeredWeight) * 100);

  return {
    score,
    band: toBand(score),
    action: toAction(score, results),
    byCategory,
    answered,
    total: checkpoints.length,
  };
}

export function toBand(score: number): ConditionBand {
  if (score >= 80) return "healthy";
  if (score >= 60) return "moderate";
  if (score >= 40) return "high_risk";
  return "critical";
}

export function toAction(
  score: number,
  _results: CheckpointResult[],
): RecommendedAction {
  const band = toBand(score);
  if (band === "healthy") return "maintain";
  if (band === "moderate") return "repair";
  if (band === "high_risk") return "repair";
  return "replace_plan";
}

export function categoryBreakdownPercent(
  breakdown: ScoreBreakdown,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [cat, { score, weight }] of Object.entries(breakdown.byCategory)) {
    out[cat] = weight > 0 ? Math.round((score / weight) * 100) : 0;
  }
  return out;
}

export function emptyResults(
  checkpoints: TemplateCheckpoint[],
): CheckpointResult[] {
  return checkpoints.map((cp) => ({
    checkpoint_id: cp.id,
    rating: null,
    notes: null,
    photo_urls: [],
  }));
}

// Walk a checkpoint-grouped template with existing results, zipping results
// into the right slot (and creating placeholders for new checkpoints).
export function mergeResults(
  checkpoints: TemplateCheckpoint[],
  existing: CheckpointResult[] | null,
): CheckpointResult[] {
  const empty = emptyResults(checkpoints);
  if (!existing || existing.length === 0) return empty;
  const index = new Map(existing.map((r) => [r.checkpoint_id, r]));
  return empty.map((slot) => {
    const prior = index.get(slot.checkpoint_id);
    return prior
      ? {
          checkpoint_id: slot.checkpoint_id,
          rating: prior.rating ?? null,
          notes: prior.notes ?? null,
          photo_urls: prior.photo_urls ?? [],
        }
      : slot;
  });
}

export { groupCheckpointsByCategory };
