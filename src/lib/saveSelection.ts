import type { GameState } from '../types/auth';

/** Preserve undated local data rather than silently replacing an older-format save. */
export function chooseSave(local: GameState | null, cloud: GameState, cloudUpdatedAt: string): GameState {
  if (!local) return cloud;
  const localTime = local.savedAt ? Date.parse(local.savedAt) : NaN;
  const cloudTime = Date.parse(cloud.savedAt || cloudUpdatedAt);
  if (!Number.isFinite(localTime) || !Number.isFinite(cloudTime) || localTime > cloudTime) return local;
  return cloud;
}
