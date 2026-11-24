import { getFixtureState } from "@/lib/data/fixture-repo";
import { isE2EFixtureMode } from "@/lib/env";

export const dynamic = "force-dynamic";

/** Fixture mode only: stands in for the Supabase signed upload URL. */
export async function PUT(request: Request, { params }: { params: Promise<{ assetId: string }> }) {
  if (!isE2EFixtureMode()) return new Response(null, { status: 404 });
  const { assetId } = await params;
  const bytes = new Uint8Array(await request.arrayBuffer());
  getFixtureState().assetBlobs.set(assetId, {
    bytes,
    contentType: request.headers.get("content-type") ?? "application/octet-stream",
  });
  return new Response(null, { status: 200 });
}
