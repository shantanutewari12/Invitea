import { ImageResponse } from "next/og";

/**
 * Generates the PWA icons at build time. Statically prerendered so the service
 * worker can precache them (see next.config.ts). Same mark as app/icon.svg: a maroon tile,
 * an ivory "i" whose dot is a gold sparkle.
 */
export const dynamic = "force-static";
export const dynamicParams = false;

const SIZES = {
  "192": { px: 192, maskable: false },
  "512": { px: 512, maskable: false },
  "maskable-512": { px: 512, maskable: true },
} as const;

type SizeKey = keyof typeof SIZES;

export function generateStaticParams() {
  return (Object.keys(SIZES) as SizeKey[]).map((size) => ({ size }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  const spec = SIZES[size as SizeKey];
  if (!spec) return new Response("Not found", { status: 404 });

  const { px, maskable } = spec;
  // Maskable icons keep important content inside the central 80% safe zone.
  const mark = Math.round(px * (maskable ? 0.58 : 0.8));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: maskable ? "linear-gradient(135deg, #9b2c52, #5e1229)" : "#fbf3e4",
        }}
      >
        <div
          style={{
            width: mark,
            height: mark,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg, #9b2c52, #5e1229)",
            borderRadius: maskable ? 0 : Math.round(mark * 0.234),
          }}
        >
          <svg width={mark} height={mark} viewBox="0 0 64 64">
            <rect x="27" y="33" width="10" height="21" rx="5" fill="#fbf3e4" />
            <path d="M32 8 35.2 15.8 43 19 35.2 22.2 32 30 28.8 22.2 21 19 28.8 15.8Z" fill="#f0c36a" />
          </svg>
        </div>
      </div>
    ),
    { width: px, height: px },
  );
}
