"use client";

import { create, templates } from "@/copy/en";
import type { EventType, TemplateId } from "@/lib/spec/constants";
import { designsFor } from "@/lib/spec/designs";
import { BookCover, type CoverText } from "@/renderer/book/Book";

/** The occasion's invitation templates, each shown as its real cover. Used when creating and when editing. */
export function TemplatePicker({
  eventType,
  value,
  onChange,
  text,
}: {
  eventType: EventType;
  value: TemplateId;
  onChange: (id: TemplateId) => void;
  text: CoverText;
}) {
  return (
    <div role="radiogroup" aria-label={create.chooseLook} className="grid grid-cols-2 gap-x-3 gap-y-4">
      {designsFor(eventType).map((design) => {
        const selected = design.id === value;
        return (
          <button
            key={design.id}
            type="button"
            role="radio"
            aria-checked={selected}
            data-testid={`template-${design.id}`}
            onClick={() => onChange(design.id)}
            className={`flex flex-col items-center gap-2 rounded-2xl p-1.5 text-center outline-none transition focus-visible:ring-3 focus-visible:ring-ring/50 ${
              selected ? "bg-accent ring-2 ring-primary" : "hover:bg-muted"
            }`}
          >
            <div className="pointer-events-none w-full">
              <BookCover design={design} text={text} />
            </div>
            <span className="text-sm leading-tight font-bold">
              {templates[design.id].name}
              {selected ? ` · ${create.picked}` : ""}
            </span>
            <span className="text-xs text-muted-foreground">{templates[design.id].blurb}</span>
          </button>
        );
      })}
    </div>
  );
}

