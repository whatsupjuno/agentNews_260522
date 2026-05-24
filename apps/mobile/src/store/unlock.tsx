import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { secureStore } from '../services/secureStore';

const BACKGROUND_DISARM_MS = 5000;

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
  const backgroundedAtRef = useRef<number | null>(null);

  // 부팅 시 stored unlock 복원 — 단 REQ-024 의해 앱 재시작은 invalidate. 그래서 일부러 안 복원함.
  // unlock token 은 메모리에만. secureStore 에는 expiresAt 기록만 둠 (audit 용 추후).
  useEffect(() => {
    void secureStore.remove('unlockToken');
    void secureStore.remove('unlockExpiresAt');
  }, []);

  // 백그라운드 5초 자동 disarm (REQ-023)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'background' || next === 'inactive') {
        backgroundedAtRef.current = Date.now();
      } else if (next === 'active') {
        const bgAt = backgroundedAtRef.current;
        backgroundedAtRef.current = null;
        if (bgAt && Date.now() - bgAt >= BACKGROUND_DISARM_MS) {
          void doClear('BACKGROUND');
        }
      }
    });
    return () => sub.remove();
  }, []);

  // 60분 만료 timer (handoff §8.4)
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
    // 메모리만. 디스크 저장 X. (REQ-024)
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
