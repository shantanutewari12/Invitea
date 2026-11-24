import { brand } from "@/copy/en";

/** The Invitea mark: a maroon tile with an ivory "i" whose dot is a gold sparkle. */
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="shrink-0">
      <defs>
        <linearGradient id="invitea-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#9b2c52" />
          <stop offset="1" stopColor="#5e1229" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill="url(#invitea-mark)" />
      <rect x="27" y="33" width="10" height="21" rx="5" fill="#fbf3e4" />
      <path d="M32 8 35.2 15.8 43 19 35.2 22.2 32 30 28.8 22.2 21 19 28.8 15.8Z" fill="#f0c36a" />
    </svg>
  );
}

export function Logo({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <BrandMark size={size} />
      <span className="font-display font-bold tracking-tight">{brand.name}</span>
    </span>
  );
}
