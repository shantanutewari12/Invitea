import type { ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const control =
  "w-full rounded-none border-0 border-b-[1.5px] border-input bg-transparent px-0 text-base outline-none transition-colors focus-visible:border-b-2 focus-visible:border-ring disabled:opacity-50";

export function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(control, "h-11", className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(control, "min-h-24 py-2", className)} {...props} />;
}

/** Two-or-more option segmented control (radio group semantics). */
export function Segmented<T extends string>({
  name,
  value,
  options,
  onChange,
}: {
  name: string;
  value: T;
  options: { value: T; label: string; hint?: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={name} className="grid auto-cols-fr grid-flow-col gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "flex min-h-11 flex-col items-center justify-center rounded-xl border-2 px-3 py-2 text-sm font-bold transition-colors",
            value === option.value ? "border-primary bg-primary text-primary-foreground" : "border-foreground bg-transparent hover:bg-foreground/5",
          )}
        >
          {option.label}
          {option.hint && <span className="text-xs font-normal opacity-80">{option.hint}</span>}
        </button>
      ))}
    </div>
  );
}
