import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { secureStore } from '../services/secureStore';

interface UnlockState {
  token: string | null;
  expiresAt: number | null;
}

interface UnlockContextValue extends UnlockState {
  setUnlock(token: string, expiresAtIso: string): Promise<void>;
  clearUnlock(reason?: string): Promise<void>;
  isUnlocked(): boolean;
}

const Ctx = createContext<UnlockContextValue | null>(null);

export function UnlockProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<UnlockState>({ token: null, expiresAt: null });

  // 부팅 시 stored unlock 복원 안 함 — REQ-024 + 위장 강화 (앱 재시작 시 항상 NewsFeed)
  useEffect(() => {
    void secureStore.remove('unlockToken');
    void secureStore.remove('unlockExpiresAt');
  }, []);

  /**
   * 위장 강화: 어떤 종류든 backgrounding 진입 시 즉시 disarm.
   * - 다른 앱 전환 / 홈 버튼 / App Switcher 호출 / 잠금 등 모든 경우
   * - inactive (iOS App Switcher 띄울 때) 또는 background (실제 백그라운드) 진입 즉시
   *
   * REQ-023 의 "5초 마진" 정책은 더 엄격한 위장 요구로 deprecated.
   */
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'inactive' || next === 'background') {
        void doClear('BACKGROUND');
      }
    });
    return () => sub.remove();
  }, []);

  // 60분 자연 만료 (handoff §8.4)
  useEffect(() => {
    if (!state.expiresAt) return;
    const remaining = state.expiresAt - Date.now();
    if (remaining <= 0) {
      void doClear('EXPIRED');
      return;
    }
    const t = setTimeout(() => void doClear('EXPIRED'), remaining);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.expiresAt]);

  async function doClear(_reason: string): Promise<void> {
    setState({ token: null, expiresAt: null });
    await secureStore.remove('unlockToken');
    await secureStore.remove('unlockExpiresAt');
  }

  const setUnlock = useCallback(async (token: string, expiresAtIso: string) => {
    const expiresAt = new Date(expiresAtIso).getTime();
    setState({ token, expiresAt });
  }, []);

  const clearUnlock = useCallback(async (reason?: string) => {
    await doClear(reason ?? 'MANUAL');
  }, []);

  const isUnlocked = useCallback(() => {
    if (!state.token || !state.expiresAt) return false;
    return state.expiresAt > Date.now();
  }, [state]);

  const value: UnlockContextValue = useMemo(
    () => ({ ...state, setUnlock, clearUnlock, isUnlocked }),
    [state, setUnlock, clearUnlock, isUnlocked],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUnlock(): UnlockContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useUnlock must be used within UnlockProvider');
  return ctx;
}
