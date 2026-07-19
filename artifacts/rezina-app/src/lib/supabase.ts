import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[Rezina Civic] Supabase environment variables not set.\n' +
    'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to connect to the database.'
  );
}

export const supabase = createClient(
  supabaseUrl ?? 'https://placeholder.supabase.co',
  supabaseAnonKey ?? 'placeholder'
);

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Report {
  id: string;
  title: string;
  category: string;
  description: string;
  latitude: number;
  longitude: number;
  photo_url: string | null;
  created_at: string;
  status: string;
  votes: number;
  resolved: boolean;
  fingerprint: string | null;
  gps_accuracy: number | null;
  address: string | null;
  reporter_name: string | null;
  reporter_email: string | null;
}

export interface ReportVote {
  id: string;
  report_id: string;
  fingerprint: string;
  created_at: string;
}
