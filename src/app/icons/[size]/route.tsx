import { ImageResponse } from "next/og";

/**
 * Generates the PWA icons at build time. Statically prerendered so the service
 * worker can precache them (see next.config.ts).
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
  const inner = Math.round(px * (maskable ? 0.52 : 0.64));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#fbf3e4",
        }}
      >
        <div
          style={{
            width: inner,
            height: Math.round(inner * 1.15),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#7a1f3d",
            borderRadius: Math.round(inner * 0.14),
            boxShadow: `inset 0 0 0 ${Math.max(3, Math.round(px / 64))}px #d4a24c`,
            color: "#f3dfa8",
            fontSize: Math.round(inner * 0.6),
            fontWeight: 700,
          }}
        >
          R
        </div>
      </div>
    ),
    { width: px, height: px },
  );
}
