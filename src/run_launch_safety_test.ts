import assert from 'node:assert/strict';
import { chooseSave } from './lib/saveSelection';
import { getStorageAccount, setStorageAccount, storageKey } from './lib/storage';
import type { GameState } from './types/auth';

const local = { savedAt: '2026-01-02T00:00:00Z' } as GameState;
const cloud = { savedAt: '2026-01-01T00:00:00Z' } as GameState;
assert.equal(chooseSave(local, cloud, cloud.savedAt!), local, 'newer local progress survives');
assert.equal(chooseSave(cloud, local, local.savedAt!), local, 'newer cloud progress is selected');
assert.equal(chooseSave({} as GameState, cloud, cloud.savedAt!).savedAt, undefined, 'legacy local saves are preserved');
assert.equal(chooseSave(local, { savedAt: 'invalid' } as GameState, 'invalid'), local, 'invalid timestamps cannot replace local progress');
assert.equal(chooseSave(null, cloud, cloud.savedAt!), cloud, 'cloud save is available on a new device');

setStorageAccount(null);
assert.equal(storageKey('save'), 'save');
setStorageAccount('account-a');
const accountAKey = storageKey('save');
setStorageAccount('account-b');
assert.notEqual(storageKey('save'), accountAKey);
assert.equal(getStorageAccount(), 'account-b');
setStorageAccount(null);
assert.equal(storageKey('save'), 'save');
console.log('Launch safety checks passed.');
