import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for use in the browser (Client Components).
 *
 * Foundation only — no part of the app calls this yet. Uses the public
 * anon key, which is safe to expose; Row Level Security policies on the
 * database are what actually restrict what it can read/write.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
