import { supabase } from './supabaseClient';
import { GameState, RunSummary } from '../types/auth';
import { getStorageAccount, storageKey } from './storage';
import { chooseSave } from './saveSelection';

// Serialize mutations so an older autosave cannot arrive after a newer one.
let mutationQueue: Promise<void> = Promise.resolve();
function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const result = mutationQueue.then(operation);
  mutationQueue = result.then(() => undefined, () => undefined);
  return result;
}

/**
 * Saves the current game state to local storage and upserts it to Supabase if authenticated.
 */
export async function saveGameState(state: GameState): Promise<{ success: boolean; cloudSynced: boolean }> {
  state = JSON.parse(JSON.stringify(state)) as GameState;
  const accountId = getStorageAccount();
  const localKey = storageKey(`nationstate_active_save_${state.scenarioId}`);
  let localSaved = false;
  
  // 1. Local Save (Instant & Reliable)
  try {
    localStorage.setItem(localKey, JSON.stringify(state));
    localSaved = true;
  } catch (err) {
    console.error('Failed to write save state to localStorage:', err);
  }

  return enqueue(async () => {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) {
      // Soft fail, user might not be logged in or session expired
      return { success: localSaved, cloudSynced: false };
    }

    if (user && accountId === user.id && getStorageAccount() === accountId) {
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
        return { success: localSaved, cloudSynced: false };
      }
      return { success: true, cloudSynced: true };
    }
  } catch (err) {
    console.error('Network error during cloud save sync:', err);
  }

  return { success: localSaved, cloudSynced: false };
  });
}

/**
 * Loads the newest known save, retaining legacy local saves whose age is unknown.
 */
export async function loadSave(scenarioId: string): Promise<GameState | null> {
  const localKey = storageKey(`nationstate_active_save_${scenarioId}`);
  const accountId = getStorageAccount();
  let localState: GameState | null = null;
  try {
    const raw = localStorage.getItem(localKey);
    if (raw) localState = JSON.parse(raw) as GameState;
  } catch (err) { console.error("Failed to parse local save:", err); }
  await mutationQueue;

  // 1. Attempt Cloud Load
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (!authError && user && user.id === accountId) {
      const { data, error } = await supabase
        .from('game_saves')
        .select('game_state_json, updated_at')
        .eq('user_id', user.id)
        .eq('scenario_id', scenarioId)
        .maybeSingle();

      if (!error && data && data.game_state_json) {
        if (getStorageAccount() !== accountId) return null;
        const cloudState = data.game_state_json as GameState;
        if (chooseSave(localState, cloudState, data.updated_at) === localState) return localState;
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

  if (getStorageAccount() !== accountId) return null;
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
  const localRunsKey = storageKey('nationstate_past_runs');
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
    if (!authError && user && user.id === getStorageAccount()) {
      const { error } = await supabase
        .from('run_history')
        .insert({
          user_id: user.id,
          scenario_id: summary.scenario_id,
          turns_survived: summary.turns_survived,
          result: summary.result,
          loss_reason: summary.loss_reason,
          ended_at: currentRun.ended_at,
          grade: summary.grade,
          performance_title: summary.performanceTitle,
          badges_earned: summary.badgesEarned,
          final_stats: summary.finalStats,
          end_reason: summary.endReason,
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
  const localRunsKey = storageKey('nationstate_past_runs');
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
    if (!authError && user && user.id === getStorageAccount()) {
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
          grade: r.grade,
          performanceTitle: r.performance_title,
          badgesEarned: r.badges_earned,
          finalStats: r.final_stats,
          endReason: r.end_reason,
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

export async function clearRunHistory(): Promise<boolean> {
  const key = storageKey('nationstate_past_runs');
  const accountId = getStorageAccount();
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if ((error && error.name !== 'AuthSessionMissingError') || getStorageAccount() !== accountId || (accountId && user?.id !== accountId)) return false;
    if (user && user.id === accountId) {
      const { error: deleteError } = await supabase.from('run_history').delete().eq('user_id', user.id);
      if (deleteError) return false;
    }
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error('Failed to clear run history:', error);
    return false;
  }
}

/** Delete both copies; a failed cloud deletion is reported to the caller. */
export async function deleteSavedGame(scenarioId: string): Promise<boolean> {
  const localKey = storageKey(`nationstate_active_save_${scenarioId}`);
  const accountId = getStorageAccount();
  return enqueue(async () => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError && authError.name !== 'AuthSessionMissingError') return false;
      if (getStorageAccount() !== accountId || (user && user.id !== accountId) || (!user && accountId)) return false;
      if (user) {
        const { error } = await supabase.from('game_saves').delete().eq('user_id', user.id).eq('scenario_id', scenarioId);
        if (error) return false;
      }
      localStorage.removeItem(localKey);
      return true;
    } catch (err) {
      console.error('Failed to delete save:', err);
      return false;
    }
  });
}
