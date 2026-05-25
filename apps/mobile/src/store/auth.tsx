import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiFetch, ApiError } from '../services/api';
import { secureStore } from '../services/secureStore';
import {
  registerPushTokenWithBackend,
  resetPushRegistrationCache,
} from '../services/pushRegistration';

export interface AuthUser {
  externalId: string;
  userId: string;
  nickname: string;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  status: 'loading' | 'unauthenticated' | 'authenticated';
  isAdmin: boolean;
}

interface AuthContextValue extends AuthState {
  register(args: { userId: string; password: string; nickname?: string }): Promise<void>;
  login(args: { userId: string; password: string }): Promise<void>;
  logout(): Promise<void>;
  getValidAccessToken(): Promise<string | null>;
}

const Ctx = createContext<AuthContextValue | null>(null);

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

function isJwtExpired(token: string, marginSec = 0): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3 || !parts[1]) return true;
    const payload = parts[1];
    const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
    const b64 = padded.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = globalThis.atob ? globalThis.atob(b64) : '';
    if (!decoded) return true;
    const obj = JSON.parse(decoded) as { exp?: number };
    if (typeof obj.exp !== 'number') return true;
    return obj.exp * 1000 < Date.now() + marginSec * 1000;
  } catch {
    return true;
  }
}

/** /admin/me/whoami 호출 → admin 인지 검증 (403 면 false) */
async function checkIsAdmin(accessToken: string): Promise<boolean> {
  try {
    await apiFetch('/admin/me/whoami', { accessToken });
    return true;
  } catch {
    return false;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: null,
    refreshToken: null,
    status: 'loading',
    isAdmin: false,
  });

  useEffect(() => {
    void (async () => {
      const [accessToken, refreshToken, externalId, userId, nickname] = await Promise.all([
        secureStore.get('accessToken'),
        secureStore.get('refreshToken'),
        secureStore.get('userExternalId'),
        secureStore.get('userId'),
        secureStore.get('userNickname'),
      ]);
      if (accessToken && refreshToken && externalId && userId && nickname) {
        setState({
          user: { externalId, userId, nickname },
          accessToken,
          refreshToken,
          status: 'authenticated',
          isAdmin: false,
        });
        void registerPushTokenWithBackend(accessToken);
        void checkIsAdmin(accessToken).then((ok) => setState((s) => ({ ...s, isAdmin: ok })));
      } else {
        setState((s) => ({ ...s, status: 'unauthenticated' }));
      }
    })();
  }, []);

  async function forceUnauthenticated(): Promise<void> {
    await secureStore.clear();
    setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      status: 'unauthenticated',
      isAdmin: false,
    });
  }

  async function persist(res: AuthResponse) {
    await Promise.all([
      secureStore.set('accessToken', res.accessToken),
      secureStore.set('refreshToken', res.refreshToken),
      secureStore.set('userExternalId', res.user.externalId),
      secureStore.set('userId', res.user.userId),
      secureStore.set('userNickname', res.user.nickname),
    ]);
    setState({
      user: res.user,
      accessToken: res.accessToken,
      refreshToken: res.refreshToken,
      status: 'authenticated',
      isAdmin: false,
    });
    void registerPushTokenWithBackend(res.accessToken);
    void checkIsAdmin(res.accessToken).then((ok) => setState((s) => ({ ...s, isAdmin: ok })));
  }

  const value: AuthContextValue = useMemo(
    () => ({
      ...state,
      async register(args) {
        const res = await apiFetch<AuthResponse>('/auth/register', {
          method: 'POST',
          body: args,
        });
        await persist(res);
      },
      async login(args) {
        const res = await apiFetch<AuthResponse>('/auth/login', { method: 'POST', body: args });
        await persist(res);
      },
      async logout() {
        const rt = state.refreshToken;
        await secureStore.clear();
        resetPushRegistrationCache();
        setState({
          user: null,
          accessToken: null,
          refreshToken: null,
          status: 'unauthenticated',
          isAdmin: false,
        });
        if (rt) {
          try {
            await apiFetch('/auth/logout', { method: 'POST', refreshToken: rt });
          } catch {
            // ignore
          }
        }
      },
      async getValidAccessToken() {
        if (state.accessToken && !isJwtExpired(state.accessToken, 30)) {
          return state.accessToken;
        }
        const rt = state.refreshToken;
        if (!rt) {
          await forceUnauthenticated();
          return null;
        }
        try {
          const res = await apiFetch<AuthResponse>('/auth/refresh', {
            method: 'POST',
            refreshToken: rt,
          });
          await persist(res);
          return res.accessToken;
        } catch {
          await forceUnauthenticated();
          return null;
        }
      },
    }),
    [state],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
