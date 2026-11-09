import { createBrowserClient } from '@supabase/ssr';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isConfigured = Boolean(
  URL && KEY && !URL.includes('YOUR-PROJECT') && !KEY.includes('YOUR_ANON'),
);

type Client = ReturnType<typeof createBrowserClient>;
let client: Client | null = null;

/** Browser Supabase client (uses the signed-in admin's session + RLS). */
export function getSupabase(): Client {
  if (!client) {
    client = createBrowserClient(
      URL ?? 'https://placeholder.supabase.co',
      KEY ?? 'placeholder-key',
    );
  }
  return client;
}
