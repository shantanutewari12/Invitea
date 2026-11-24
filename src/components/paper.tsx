import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import { create, fmt } from "@/copy/en";
import { cn } from "@/lib/utils";

/** Paper-form field: small uppercase tracked label, underline-only control. */
export function FormField({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-bold tracking-[0.18em] text-muted-foreground uppercase">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export const underlineControl =
  "w-full min-h-11 rounded-none border-0 border-b-[1.5px] border-input bg-transparent px-0 py-2 text-base outline-none focus-visible:border-b-2 focus-visible:border-ring";

/** Chips: the selected one is filled, the others outlined. */
export function ChipGroup<T extends string>({
  name,
  value,
  options,
  onChange,
}: {
  name: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={name} className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "min-h-11 rounded-full border-2 px-4 text-sm font-bold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            value === option.value ? "border-primary bg-primary text-primary-foreground" : "border-foreground hover:bg-foreground/5",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

const pill =
  "inline-flex min-h-12 w-full items-center justify-center rounded-full border-2 px-6 text-base font-bold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50";

/** Primary = filled with the theme's button colours; secondary = outlined 2px ink. */
export function PillButton({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" }) {
  return (
    <button
      className={cn(pill, variant === "primary" ? "border-primary bg-primary text-primary-foreground" : "border-foreground", className)}
      {...props}
    />
  );
}

export function PillLink({ href, variant = "primary", children }: { href: string; variant?: "primary" | "secondary"; children: ReactNode }) {
  return (
    <Link href={href} className={cn(pill, variant === "primary" ? "border-primary bg-primary text-primary-foreground" : "border-foreground")}>
      {children}
    </Link>
  );
}

/** Back, "Step n of 4" and the progress bars. */
export function StepHeader({ step, total, onBack }: { step: number; total: number; onBack?: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        {onBack ? (
          <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center text-sm font-semibold text-muted-foreground">
            ‹ {create.back}
          </button>
        ) : (
          <span className="min-h-11" />
        )}
        <p className="text-xs font-bold tracking-[0.22em] text-muted-foreground uppercase">{fmt(create.stepOf, { n: step, total })}</p>
      </div>
      <div className="flex gap-2" role="presentation">
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={cn("h-1.5 flex-1 rounded-full", i < step ? "bg-foreground" : "bg-foreground/20")} />
        ))}
      </div>
    </div>
  );
}
