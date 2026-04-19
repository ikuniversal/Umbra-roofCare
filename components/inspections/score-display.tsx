import { Badge } from "@/components/ui/badge";
import {
  CONDITION_BAND_LABELS,
  CONDITION_BAND_VARIANTS,
  RECOMMENDED_ACTION_LABELS,
} from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { ConditionBand, RecommendedAction } from "@/lib/types";

interface ScoreDisplayProps {
  score: number | null;
  band: ConditionBand | null;
  action?: RecommendedAction | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const BAND_STROKE: Record<ConditionBand, string> = {
  healthy: "#3A6E42",
  moderate: "#D97706",
  high_risk: "#A06428",
  critical: "#9B2C2C",
};

export function ScoreDisplay({
  score,
  band,
  action,
  size = "md",
  className,
}: ScoreDisplayProps) {
  const displayScore = Math.max(0, Math.min(100, score ?? 0));
  const radius = size === "lg" ? 68 : size === "sm" ? 32 : 48;
  const stroke = size === "lg" ? 10 : size === "sm" ? 5 : 8;
  const diameter = radius * 2 + stroke * 2;
  const circumference = 2 * Math.PI * radius;
  const dashoffset =
    score === null
      ? circumference
      : circumference - (displayScore / 100) * circumference;
  const color = band ? BAND_STROKE[band] : "#C9BFA5";
  const numberClass =
    size === "lg" ? "text-5xl" : size === "sm" ? "text-xl" : "text-3xl";

  return (
    <div className={cn("flex items-center gap-4", className)}>
      <div className="relative" style={{ width: diameter, height: diameter }}>
        <svg
          className="-rotate-90"
          width={diameter}
          height={diameter}
          viewBox={`0 0 ${diameter} ${diameter}`}
          aria-hidden
        >
          <circle
            cx={diameter / 2}
            cy={diameter / 2}
            r={radius}
            stroke="#E4DDC9"
            strokeWidth={stroke}
            fill="none"
          />
          <circle
            cx={diameter / 2}
            cy={diameter / 2}
            r={radius}
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashoffset}
            fill="none"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={cn(
              "metric-figure tabular-nums leading-none text-brand-primary",
              numberClass,
            )}
          >
            {score === null ? "—" : displayScore}
          </span>
          {size !== "sm" ? (
            <span className="label-mono mt-1">Score</span>
          ) : null}
        </div>
      </div>
      {(band || action) && size !== "sm" ? (
        <div className="space-y-1">
          {band ? (
            <Badge variant={CONDITION_BAND_VARIANTS[band]}>
              {CONDITION_BAND_LABELS[band]}
            </Badge>
          ) : null}
          {action ? (
            <p className="label-mono">
              Action · {RECOMMENDED_ACTION_LABELS[action]}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
