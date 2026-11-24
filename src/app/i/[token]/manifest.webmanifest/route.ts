import { SITE } from "@/config/site";
import { brand } from "@/copy/en";
import { isPlausibleInviteKey } from "@/lib/token-format";

export const dynamic = "force-dynamic";

/**
 * Per-invitation web app manifest so "Add to Home Screen" reopens this exact invitation.
 * Deliberately generic (no guest or host names): it only contains the invite key the
 * visitor already has in their URL.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isPlausibleInviteKey(token)) return new Response("Not found", { status: 404 });

  const startUrl = `/i/${encodeURIComponent(token)}`;
  const manifest = {
    id: startUrl,
    name: `${brand.name} invitation`,
    short_name: "Invitation",
    start_url: startUrl,
    scope: SITE.viewerPathPrefix,
    display: "standalone",
    background_color: SITE.backgroundColor,
    theme_color: SITE.themeColor,
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
  return new Response(JSON.stringify(manifest), {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
