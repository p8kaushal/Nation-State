// Guest data keeps the original keys so existing local games remain available.
// Signed-in users get separate keys on shared devices.
let accountId: string | null = null;

export function setStorageAccount(id: string | null): void {
  accountId = id;
}

export function getStorageAccount(): string | null {
  return accountId;
}

export function storageKey(key: string): string {
  return accountId ? `nationstate_user_${accountId}_${key}` : key;
}
