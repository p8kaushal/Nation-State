import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || '';

export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
// A valid inert client allows the game to run locally without cloud configuration.
export const supabase = createClient(supabaseUrl || 'http://localhost:54321', supabaseAnonKey || 'local-only');
