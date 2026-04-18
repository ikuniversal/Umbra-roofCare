import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  variant?: "default" | "inverse";
  size?: "sm" | "md" | "lg";
}

export function RoofMark({
  className,
  variant = "default",
}: {
  className?: string;
  variant?: "default" | "inverse";
}) {
  const stroke = variant === "inverse" ? "#FAF7F0" : "#1F2937";
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-6 w-6", className)}
      aria-hidden="true"
    >
      <path
        d="M3 18L16 6L29 18"
        stroke={stroke}
        strokeWidth="1.75"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
      <path
        d="M7 18V26H25V18"
        stroke={stroke}
        strokeWidth="1.25"
        strokeLinecap="square"
        strokeLinejoin="miter"
        opacity="0.6"
      />
      <path
        d="M14 26V20H18V26"
        stroke="#D97706"
        strokeWidth="1.25"
        strokeLinecap="square"
      />
    </svg>
  );
}

export function Logo({
  className,
  variant = "default",
  size = "md",
}: LogoProps) {
  const inverse = variant === "inverse";
  const sizeMap = {
    sm: { mark: "h-5 w-5", main: "text-lg", sub: "text-[10px]" },
    md: { mark: "h-7 w-7", main: "text-[22px]", sub: "text-[11px]" },
    lg: { mark: "h-9 w-9", main: "text-3xl", sub: "text-xs" },
  };
  const s = sizeMap[size];
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <RoofMark className={s.mark} variant={variant} />
      <div className="flex flex-col leading-none">
        <span
          className={cn(
            "font-serif font-bold tracking-tight",
            s.main,
            inverse ? "text-brand-bg" : "text-brand-primary",
          )}
        >
          Umbra
        </span>
        <span
          className={cn(
            "font-medium tracking-wider",
            s.sub,
            inverse ? "text-brand-bg/70" : "text-brand-muted",
          )}
        >
          RoofCare
        </span>
      </div>
    </div>
  );
}
