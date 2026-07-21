import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

/**
 * Supabase browser client.
 *
 * This clean GitHub Pages copy must point to its own Supabase project.
 * Do not paste credentials from the Lovable/original project here.
 *
 * In GitHub Pages, Vite replaces VITE_* values during build time. That means
 * changing the Supabase project later requires rebuilding and redeploying Pages.
 */
function createSupabaseClient() {
  // Client-side static build: values come from GitHub Actions/local .env as VITE_*.
  // Local SSR/dev fallback: values can also come from process.env for compatibility.
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    const missing = [
      ...(!SUPABASE_URL ? ['SUPABASE_URL'] : []),
      ...(!SUPABASE_PUBLISHABLE_KEY ? ['SUPABASE_PUBLISHABLE_KEY'] : []),
    ];
    const message = `Missing Supabase environment variable(s): ${missing.join(', ')}. Connect Supabase in Lovable Cloud.`;
    console.error(`[Supabase] ${message}`);
    throw new Error(message);
  }

  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      // Persisting sessions in localStorage is what keeps the user logged in after reloads.
      storage: typeof window !== 'undefined' ? localStorage : undefined,
      persistSession: true,
      autoRefreshToken: true,
    }
  });
}

let _supabase: ReturnType<typeof createSupabaseClient> | undefined;

// Lazy proxy: importing this module does not crash immediately if env vars are missing.
// The clear error is raised only when some code actually calls supabase.from/auth/etc.
export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_, prop, receiver) {
    if (!_supabase) _supabase = createSupabaseClient();
    return Reflect.get(_supabase, prop, receiver);
  },
});
