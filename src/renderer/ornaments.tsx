import type { TemplateStyle } from "./templates";

/** Small inline SVG ornaments (no network, no images). All use the invite accent colour. */

function Glyph({ variant }: { variant: TemplateStyle["ornament"] }) {
  switch (variant) {
    case "lotus":
      return (
        <path
          d="M12 3c1.8 2.6 2.4 5.2 0 8.4C9.6 8.2 10.2 5.6 12 3zm-7 6c3 .2 5 1.6 6.4 4-3 .6-5.6-.4-6.4-4zm14 0c-.8 3.6-3.4 4.6-6.4 4 1.4-2.4 3.4-3.8 6.4-4zM12 21c-3-.8-5.4-3.2-6-6 2.6.4 4.6 1.6 6 3.6 1.4-2 3.4-3.2 6-3.6-.6 2.8-3 5.2-6 6z"
          fill="currentColor"
        />
      );
    case "diamond":
      return <path d="M12 3l6 9-6 9-6-9 6-9zm0 5.2L9.6 12l2.4 3.8 2.4-3.8L12 8.2z" fill="currentColor" fillRule="evenodd" />;
    case "vine":
      return (
        <path
          d="M12 20c0-5-4-6-4-10 0-2 1.5-3.5 4-3.5s4 1.5 4 3.5c0 4-4 5-4 10zm0-9.5a1.6 1.6 0 100-3.2 1.6 1.6 0 000 3.2zM5 14c2 0 3.6 1 4.4 2.6-2.2.4-4-.4-4.4-2.6zm14 0c-.4 2.2-2.2 3-4.4 2.6.8-1.6 2.4-2.6 4.4-2.6z"
          fill="currentColor"
          fillRule="evenodd"
        />
      );
    case "crescent":
      return (
        <path d="M15.5 4a8 8 0 100 16 8.4 8.4 0 01-5.5-8A8.4 8.4 0 0115.5 4zm3.5 3l.7 1.6 1.6.7-1.6.7L19 11.6l-.7-1.6-1.6-.7 1.6-.7L19 7z" fill="currentColor" />
      );
  }
}

export function OrnamentDivider({ variant, className = "" }: { variant: TemplateStyle["ornament"]; className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-3 text-inv-accent ${className}`} aria-hidden="true">
      <span className="h-px w-16 bg-linear-to-r from-transparent to-inv-accent" />
      <svg viewBox="0 0 24 24" width="22" height="22">
        <Glyph variant={variant} />
      </svg>
      <span className="h-px w-16 bg-linear-to-l from-transparent to-inv-accent" />
    </div>
  );
}
