import { createBrowserClient, createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// ─── Browser client for Client Components ────────────────────────────────────
// Manages session via cookies automatically
export function createSupabaseBrowserClient() {
  return createBrowserClient(URL, ANON);
}

// ─── Server client for Server Components & Route Handlers ────────────────────
// Reads / refreshes session from request cookies
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(URL, ANON, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // setAll is called from Server Components where cookies can't be set;
          // it's safe to ignore — the middleware handles session refresh.
        }
      },
    },
  });
}

// ─── Service-role admin client ────────────────────────────────────────────────
// Used by n8n callback and admin dashboard queries — bypasses RLS
export const supabaseServer = () =>
  createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY ?? ANON, {
    auth: { persistSession: false },
  });

// Legacy alias kept for backwards compat with existing api/results route
export { supabaseServer as supabaseAdmin };
