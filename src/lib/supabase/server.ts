import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase client for use on the server (Server Components, Route Handlers,
 * Server Actions) — reads/writes the auth session via request cookies.
 *
 * Foundation only — no part of the app calls this yet. Uses the public
 * anon key, so it's still subject to RLS; it is NOT the service-role client
 * (that key must stay server-only and is intentionally not wired up here
 * until an admin-only write path actually needs it).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component render, where cookies can't be
            // written — safe to ignore as long as middleware refreshes the
            // session on the next request (wired up when auth is added).
          }
        },
      },
    },
  );
}
