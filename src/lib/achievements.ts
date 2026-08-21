import { Achievement } from '../types/achievements';
import { GameState } from '../types/auth';
import { supabase } from './supabaseClient';

/**
 * Master catalog of all achievements.
 */
export const masterAchievements: Achievement[] = [
  {
    id: 'gdp_dynamo',
    title: 'GDP Dynamo',
    description: 'Achieve a GDP Growth Rate of greater than +4.0%/yr.',
    icon: '📈',
    category: 'economy',
    isSecret: false,
  },
  {
    id: 'ironclad_coalition',
    title: 'Ironclad Coalition',
    description: 'Maintain all four Faction Trusts at 70% or higher simultaneously.',
    icon: '🤝',
    category: 'governance',
    isSecret: false,
  },
  {
    id: 'debt_free',
    title: 'Sovereign Solvency',
    description: 'Completely eliminate the National Debt (National Debt = 0).',
    icon: '💸',
    category: 'economy',
    isSecret: false,
  },
  {
    id: 'solvency_master',
    title: 'Solvency Master',
    description: 'Grow the Treasury Budget to $50.0B or higher.',
    icon: '💰',
    category: 'economy',
    isSecret: false,
  },
  {
    id: 'petrostate_survivor',
    title: 'Petrostate Survivor',
    description: 'Win the Petrostate scenario.',
    icon: '🛢️',
    category: 'survival',
    isSecret: true,
  },
  {
    id: 'post_war_rebuilder',
    title: 'Post-War Rebuilder',
    description: 'Win the Post-War Reconstruction scenario.',
    icon: '🧱',
    category: 'survival',
    isSecret: false,
  },
  {
    id: 'fragile_defender',
    title: 'Defender of Democracy',
    description: 'Survive 20 turns in the Fragile Democracy scenario.',
    icon: '🛡️',
    category: 'survival',
    isSecret: false,
  },
  {
    id: 'clean_energy',
    title: 'Green Transition',
    description: 'Elevate the Environment Index to 80 or higher.',
    icon: '🌱',
    category: 'diplomacy',
    isSecret: false,
  },
];

/**
 * Evaluates game state on a turn-by-turn basis to check for unlocks.
 * Returns array of unlocked achievement IDs.
 */
export function checkTurnAchievements(gameState: GameState): string[] {
  const unlocked: string[] = [];
  const state = gameState.state;

  if (!state) return unlocked;

  // 1. GDP Dynamo: Growth > 4.0%
  if (state.gdpGrowthRate > 0.04) {
    unlocked.push('gdp_dynamo');
  }

  // 2. Ironclad Coalition: Faction Trusts >= 70%
  if (
    state.militaryTrust >= 70 &&
    state.businessTrust >= 70 &&
    state.publicTrust >= 70 &&
    state.internationalTrust >= 70
  ) {
    unlocked.push('ironclad_coalition');
  }

  // 3. Debt Free: Debt = 0
  if (state.nationalDebt <= 0) {
    unlocked.push('debt_free');
  }

  // 4. Solvency Master: Treasury >= 50B
  if (state.treasuryBudget >= 50_000_000_000) {
    unlocked.push('solvency_master');
  }

  // 5. Fragile Defender: survive 20 turns in fragile democracy
  if (gameState.scenarioId === 'fragile_democracy' && state.turn >= 20) {
    unlocked.push('fragile_defender');
  }

  // 6. Clean Energy: environmentIndex >= 80
  if (state.environmentIndex >= 80) {
    unlocked.push('clean_energy');
  }

  return unlocked;
}

/**
 * Evaluates game state at game-over/mandate completion to check for scenario-specific wins.
 * Returns array of unlocked achievement IDs.
 */
export function checkEndGameAchievements(gameState: GameState, isWin: boolean): string[] {
  const unlocked: string[] = [];

  if (!isWin) return unlocked;

  // 1. Petrostate Survivor
  if (gameState.scenarioId === 'petrostate') {
    unlocked.push('petrostate_survivor');
  }

  // 2. Post-War Rebuilder
  if (gameState.scenarioId === 'post_war') {
    unlocked.push('post_war_rebuilder');
  }

  return unlocked;
}

/**
 * Persists unlocked achievements locally (localStorage) and remote database (Supabase).
 * Returns list of newly/currently unlocked IDs.
 */
export async function unlockAchievements(achievementIds: string[]): Promise<string[]> {
  if (achievementIds.length === 0) return [];

  const localKey = 'nationstate_unlocked_achievements';
  let localUnlocked: string[] = [];

  // Parse local list
  try {
    const raw = localStorage.getItem(localKey);
    if (raw) localUnlocked = JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse local achievements history:', e);
  }

  // Merge & Deduplicate
  const mergedSet = new Set([...localUnlocked, ...achievementIds]);
  const finalUnlocked = Array.from(mergedSet);

  // Write to localStorage
  try {
    localStorage.setItem(localKey, JSON.stringify(finalUnlocked));
  } catch (e) {
    console.error('Failed to write achievements to localStorage:', e);
  }

  // Remote Sync
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (!authError && user) {
      // Upsert remote rows one by one or in bulk
      const rows = achievementIds.map((id) => ({
        user_id: user.id,
        achievement_id: id,
        unlocked_at: new Date().toISOString(),
      }));

      const { error: dbError } = await supabase
        .from('user_achievements')
        .upsert(rows, { onConflict: 'user_id, achievement_id' });

      if (dbError) {
        console.error('Failed to sync unlocked achievements with Supabase:', dbError);
      }
    }
  } catch (err) {
    console.error('Network exception upserting achievements to Supabase:', err);
  }

  return finalUnlocked;
}

/**
 * Fetches and merges user achievements from local cache and remote database.
 */
export async function fetchUserAchievements(): Promise<string[]> {
  const localKey = 'nationstate_unlocked_achievements';
  let localUnlocked: string[] = [];

  // Parse local list
  try {
    const raw = localStorage.getItem(localKey);
    if (raw) localUnlocked = JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse local achievements history:', e);
  }

  // Fetch Remote Sync
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (!authError && user) {
      const { data, error: dbError } = await supabase
        .from('user_achievements')
        .select('achievement_id')
        .eq('user_id', user.id);

      if (!dbError && data) {
        const remoteIds = data.map((row) => row.achievement_id);
        const mergedSet = new Set([...localUnlocked, ...remoteIds]);
        const finalUnlocked = Array.from(mergedSet);

        // Sync local cache
        try {
          localStorage.setItem(localKey, JSON.stringify(finalUnlocked));
        } catch (e) {
          console.error('Failed to sync achievements to localStorage:', e);
        }

        return finalUnlocked;
      }
    }
  } catch (err) {
    console.error('Network exception fetching achievements from Supabase:', err);
  }

  return localUnlocked;
}
