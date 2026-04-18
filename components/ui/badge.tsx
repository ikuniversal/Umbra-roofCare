import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
  {
    variants: {
      variant: {
        default: "border-brand-border bg-brand-card text-brand-muted",
        primary:
          "border-brand-primary/20 bg-brand-primary/5 text-brand-primary",
        accent:
          "border-brand-accent/30 bg-brand-accent/10 text-brand-accent",
        success:
          "border-brand-success/30 bg-brand-success/10 text-brand-success",
        warn: "border-brand-warn/30 bg-brand-warn/10 text-brand-warn",
        error:
          "border-brand-error/30 bg-brand-error/10 text-brand-error",
        outline: "border-brand-border-strong bg-transparent text-brand-muted",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
