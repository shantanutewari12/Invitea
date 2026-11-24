import type { CoverText } from "./Book";

/** A flat invitation card (used while creating). Everything scales with the card so text never spills out. */
export function InviteCard({ text, lines = [] }: { text: CoverText; lines?: string[] }) {
  return (
    <div
      data-testid="card-preview"
      style={{ containerType: "inline-size", backgroundColor: "var(--cover)", color: "var(--cover-text)", boxShadow: "0 18px 30px -12px rgb(0 0 0 / 0.45)" }}
      className="relative aspect-[5/7] w-full rounded-2xl text-center"
    >
      <div className="absolute inset-[4cqw] rounded-[3cqw] border-2 border-foil" aria-hidden="true" />
      <div className="absolute inset-[4cqw] flex flex-col items-center justify-center gap-[3cqw] overflow-hidden p-[6cqw]">
        <p className="font-sans font-bold uppercase" style={{ fontSize: "3.6cqw", letterSpacing: "0.12em" }}>
          {text.eyebrow}
        </p>
        <p className="font-display leading-none font-bold" style={{ fontSize: "18cqw" }}>
          {text.mono}
        </p>
        <p className="font-display leading-tight font-bold break-words text-balance" style={{ fontSize: "8cqw" }}>
          {text.names}
        </p>
        {lines.filter(Boolean).map((line, i) => (
          <p key={i} className="max-w-full font-sans font-semibold break-words text-balance" style={{ fontSize: "4.4cqw" }}>
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}
