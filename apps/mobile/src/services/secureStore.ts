import * as SecureStore from 'expo-secure-store';

const KEYS = {
  accessToken: 'access_token',
  refreshToken: 'refresh_token',
  unlockToken: 'unlock_token',
  unlockExpiresAt: 'unlock_expires_at',
  userExternalId: 'user_external_id',
  userNickname: 'user_nickname',
  userId: 'user_id',
} as const;

export type StoreKey = keyof typeof KEYS;

export const secureStore = {
  async set(key: StoreKey, value: string): Promise<void> {
    await SecureStore.setItemAsync(KEYS[key], value);
  },
  async get(key: StoreKey): Promise<string | null> {
    return SecureStore.getItemAsync(KEYS[key]);
  },
  async remove(key: StoreKey): Promise<void> {
    await SecureStore.deleteItemAsync(KEYS[key]);
  },
  async clear(): Promise<void> {
    await Promise.all(
      Object.values(KEYS).map((k) => SecureStore.deleteItemAsync(k).catch(() => undefined)),
    );
  },
};
