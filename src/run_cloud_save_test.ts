import assert from 'node:assert/strict';
import { supabase } from './lib/supabaseClient';
import { setStorageAccount } from './lib/storage';
import { saveGameState } from './lib/cloudSave';
import type { GameState } from './types/auth';

const values = new Map<string, string>();
Object.assign(globalThis, { localStorage: {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => values.set(key, value),
  removeItem: (key: string) => values.delete(key),
} });

let remoteRevision = 0;
let rpcCalls = 0;
let resolveAuth: ((value: unknown) => void) | undefined;
let delayAuth = false;
Object.assign(supabase.auth, {
  getUser: async () => {
    if (delayAuth) return await new Promise(resolve => { resolveAuth = resolve; });
    return { data: { user: { id: 'account-a' } }, error: null };
  },
});
Object.assign(supabase, {
  rpc: async (_name: string, args: { p_expected_revision: number | null }) => {
    rpcCalls++;
    if ((remoteRevision === 0 && args.p_expected_revision !== null) ||
        (remoteRevision !== 0 && args.p_expected_revision !== remoteRevision)) {
      return { data: { saved: false }, error: null };
    }
    return { data: { saved: true, revision: ++remoteRevision }, error: null };
  },
});

const game = (turn: number) => ({
  scenarioId: 'default', state: { turn }, decisionIndex: 0, turnLogsHistory: [],
  savedAt: `turn-${turn}`, localSaveId: `save-${turn}`,
}) as unknown as GameState;

setStorageAccount('account-a');
assert.equal((await saveGameState(game(1))).cloudSynced, true);
const [second, third] = await Promise.all([saveGameState(game(2)), saveGameState(game(3))]);
assert.equal(second.cloudSynced, true);
assert.equal(third.cloudSynced, true);
assert.equal(remoteRevision, 3, 'overlapping saves are uploaded in order');

remoteRevision++; // A different device updated the cloud save.
const conflict = await saveGameState(game(4));
assert.equal(conflict.conflict, true);
assert.equal(conflict.success, true, 'the conflicting save is still retained locally');
const local = JSON.parse(values.get('nationstate_user_account-a_nationstate_active_save_default')!);
assert.equal(local.state.turn, 4);
assert.equal(local.cloudRevision, 3);
assert.equal(local.cloudDirty, true);

// A pending operation from one account must never upload under another account.
delayAuth = true;
const pending = saveGameState(game(5));
await new Promise<void>(resolve => setTimeout(resolve, 0));
assert.ok(resolveAuth);
const callsBeforeSwitch = rpcCalls;
setStorageAccount('account-b');
resolveAuth!({ data: { user: { id: 'account-a' } }, error: null });
assert.equal((await pending).cloudSynced, false);
assert.equal(rpcCalls, callsBeforeSwitch);
setStorageAccount(null);
console.log('Cloud save ordering, conflict, and account-switch checks passed.');
