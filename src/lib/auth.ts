import { supabase } from './supabaseClient';
import { User } from '@supabase/supabase-js';

/**
 * Initiates Google OAuth Sign-In flow.
 */
export async function signInWithGoogle() {
  const redirectUrl = window.location.origin.replace(/\/$/, '');
  console.log('[AUTH] Initiating OAuth flow with callback target:', redirectUrl);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUrl,
    },
  });
  if (error) throw error;
  return data;
}

/**
 * Signs the current user out.
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * Fetches the currently logged-in user from the session/API.
 */
export async function getCurrentUser(): Promise<User | null> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) return null;
  return user;
}

/**
 * Listens to auth state changes and triggers the callback.
 * Returns an unsubscribe function.
 */
export function onAuthStateChange(callback: (user: User | null) => void) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });
  return () => {
    subscription.unsubscribe();
  };
}
