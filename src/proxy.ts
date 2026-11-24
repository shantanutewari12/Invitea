import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Keeps the host's Supabase session fresh. Guest routes (/i, token API, viewer bundle, service
 * worker) are excluded by the matcher: they never touch auth or cookies.
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || process.env.REGALIA_E2E_FIXTURES === "1") return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });
  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: [
    "/((?!i/|api/invites/by-token|api/payments/webhook|viewer/|sw\\.js|icons/|_next/|manifest\\.webmanifest|robots\\.txt|favicon\\.ico|icon\\.svg).*)",
  ],
};
