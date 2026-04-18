"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: React.ReactNode;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, id, ...props }, ref) => {
    const autoId = React.useId();
    const inputId = id ?? autoId;
    return (
      <label
        htmlFor={inputId}
        className={cn(
          "group inline-flex cursor-pointer select-none items-center gap-2 text-sm text-brand-primary",
          className,
        )}
      >
        <span className="relative inline-flex h-4 w-4 items-center justify-center rounded border border-brand-border-strong bg-brand-card transition-colors group-has-[:checked]:border-brand-primary group-has-[:checked]:bg-brand-primary">
          <input
            id={inputId}
            ref={ref}
            type="checkbox"
            className="peer absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0"
            {...props}
          />
          <Check className="h-3 w-3 text-brand-bg opacity-0 peer-checked:opacity-100" />
        </span>
        {label}
      </label>
    );
  },
);
Checkbox.displayName = "Checkbox";
