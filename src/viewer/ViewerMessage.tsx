import { OrnamentDivider } from "@/renderer/ornaments";

/**
 * Full-screen message used while loading and for friendly dead-ends
 * (e.g. "Open this link once with internet to save it."). Uses the default
 * ivory/burgundy palette because there is no invite spec yet.
 */
export function ViewerMessage({
  title,
  body,
  testId,
  actionLabel,
  onAction,
}: {
  title: string;
  body?: string;
  testId?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <main
      data-testid={testId ?? "viewer-message"}
      className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-inv-bg px-6 py-12 text-center text-inv-text"
    >
      <OrnamentDivider variant="lotus" />
      <h1 className="max-w-sm text-balance font-display text-3xl font-semibold">{title}</h1>
      {body && <p className="max-w-sm text-balance font-sans text-base leading-relaxed">{body}</p>}
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex min-h-12 items-center justify-center rounded-full bg-inv-text px-6 font-sans text-base font-semibold text-inv-bg"
        >
          {actionLabel}
        </button>
      )}
    </main>
  );
}
