import { supabase } from './supabaseClient';
import { GameState, RunSummary } from '../types/auth';

/**
 * Saves the current game state to local storage and upserts it to Supabase if authenticated.
 */
export async function saveGameState(state: GameState): Promise<{ success: boolean; cloudSynced: boolean }> {
  const localKey = `nationstate_active_save_${state.scenarioId}`;
  
  // 1. Local Save (Instant & Reliable)
  try {
    localStorage.setItem(localKey, JSON.stringify(state));
  } catch (err) {
    console.error('Failed to write save state to localStorage:', err);
  }

  // 2. Cloud Save (Sync if online & authenticated)
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) {
      // Soft fail, user might not be logged in or session expired
      return { success: true, cloudSynced: false };
    }

    if (user) {
      const { error: upsertError } = await supabase
        .from('game_saves')
        .upsert(
          {
            user_id: user.id,
            scenario_id: state.scenarioId,
            current_turn: state.state.turn,
            game_state_json: state,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'user_id, scenario_id',
          }
        );

      if (upsertError) {
        console.error('Supabase active save upload failed:', upsertError);
        return { success: true, cloudSynced: false };
      }
      return { success: true, cloudSynced: true };
    }
  } catch (err) {
    console.error('Network error during cloud save sync:', err);
  }

  return { success: true, cloudSynced: false };
}

/**
 * Loads the active game save for a scenario, prioritizing the cloud save and falling back to localStorage.
 */
export async function loadSave(scenarioId: string): Promise<GameState | null> {
  const localKey = `nationstate_active_save_${scenarioId}`;

  // 1. Attempt Cloud Load
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (!authError && user) {
      const { data, error } = await supabase
        .from('game_saves')
        .select('game_state_json')
        .eq('user_id', user.id)
        .eq('scenario_id', scenarioId)
        .maybeSingle();

      if (!error && data && data.game_state_json) {
        const cloudState = data.game_state_json as GameState;
        // Sync local cache
        try {
          localStorage.setItem(localKey, JSON.stringify(cloudState));
        } catch (e) {
          console.error('Failed to cache cloud save locally:', e);
        }
        return cloudState;
      }
    }
  } catch (err) {
    console.error('Cloud load failed, falling back to localStorage:', err);
  }

  // 2. Local Fallback
  try {
    const localRaw = localStorage.getItem(localKey);
    if (localRaw) {
      return JSON.parse(localRaw) as GameState;
    }
  } catch (err) {
    console.error('Failed to parse local save state:', err);
  }

  return null;
}

/**
 * Records a completed game run summary in the database if online, and caches in localStorage.
 */
export async function recordCompletedRun(summary: RunSummary): Promise<void> {
  const localRunsKey = 'nationstate_past_runs';
  let localRuns: RunSummary[] = [];

  // Parse local array first
  try {
    const raw = localStorage.getItem(localRunsKey);
    if (raw) localRuns = JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse local runs history:', e);
  }

  // Create clean record
  const currentRun: RunSummary = {
    ...summary,
    ended_at: summary.ended_at || new Date().toISOString(),
  };

  // Add to local cache list
  localRuns.push(currentRun);
  try {
    localStorage.setItem(localRunsKey, JSON.stringify(localRuns));
  } catch (e) {
    console.error('Failed to update local runs history list:', e);
  }

  // Attempt database insert
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (!authError && user) {
      const { error } = await supabase
        .from('run_history')
        .insert({
          user_id: user.id,
          scenario_id: summary.scenario_id,
          turns_survived: summary.turns_survived,
          result: summary.result,
          loss_reason: summary.loss_reason,
          ended_at: currentRun.ended_at,
        });

      if (error) {
        console.warn(`[Supabase Fallback] Error code ${error.code} during database insert: ${error.message}`);
      }
    }
  } catch (err) {
    console.error('Network exception recording completed run in the cloud:', err);
  }
}

/**
 * Fetches all completed runs, merging and deduplicating cloud records with local ones.
 */
export async function fetchRunHistory(): Promise<RunSummary[]> {
  const localRunsKey = 'nationstate_past_runs';
  let localRuns: RunSummary[] = [];

  // Get local runs
  try {
    const raw = localStorage.getItem(localRunsKey);
    if (raw) localRuns = JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse local runs history:', e);
  }

  // Attempt Cloud Fetch and Merge
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (!authError && user) {
      const { data, error } = await supabase
        .from('run_history')
        .select('*')
        .eq('user_id', user.id)
        .order('ended_at', { ascending: false });

      if (!error && data) {
        const remoteRuns: RunSummary[] = data.map((r) => ({
          id: r.id,
          user_id: r.user_id,
          scenario_id: r.scenario_id,
          turns_survived: r.turns_survived,
          result: r.result,
          loss_reason: r.loss_reason,
          ended_at: r.ended_at,
        }));

        // Deduplicate using ended_at, scenario, and turns as composite map keys
        const uniqueMap = new Map<string, RunSummary>();

        // Populate with cloud runs first
        remoteRuns.forEach((r) => {
          const key = `${r.scenario_id}_${r.turns_survived}_${r.ended_at}_${r.result}`;
          uniqueMap.set(key, r);
        });

        // Merge local runs
        localRuns.forEach((r) => {
          const key = `${r.scenario_id}_${r.turns_survived}_${r.ended_at}_${r.result}`;
          if (!uniqueMap.has(key)) {
            uniqueMap.set(key, r);
          }
        });

        const mergedList = Array.from(uniqueMap.values()).sort((a, b) => {
          const dateA = a.ended_at ? new Date(a.ended_at).getTime() : 0;
          const dateB = b.ended_at ? new Date(b.ended_at).getTime() : 0;
          return dateB - dateA;
        });

        // Sync local cache with the fully deduplicated remote list
        try {
          localStorage.setItem(localRunsKey, JSON.stringify(mergedList));
        } catch (e) {
          console.error('Failed to write synced runs history list to localStorage:', e);
        }

        return mergedList;
      }
    }
  } catch (err) {
    console.error('Network exception fetching cloud runs list, returning local runs only:', err);
  }

  // Fallback sorting local list
  return localRuns.sort((a, b) => {
    const dateA = a.ended_at ? new Date(a.ended_at).getTime() : 0;
    const dateB = b.ended_at ? new Date(b.ended_at).getTime() : 0;
    return dateB - dateA;
  });
}
