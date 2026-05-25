import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { apiFetch, ApiError } from '../services/api';
import { secureStore } from '../services/secureStore';

export interface AuthUser {
  externalId: string;
  email: string;
  nickname: string;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  status: 'loading' | 'unauthenticated' | 'authenticated';
}

interface AuthContextValue extends AuthState {
  register(args: { email: string; password: string; nickname: string; userId: string }): Promise<void>;
  login(args: { email: string; password: string }): Promise<void>;
  logout(): Promise<void>;
  getValidAccessToken(): Promise<string | null>;
}

const Ctx = createContext<AuthContextValue | null>(null);

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

/** JWT exp (초) 추출. 만료 또는 파싱 실패 시 true. */
function isJwtExpired(token: string, marginSec = 0): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3 || !parts[1]) return true;
    const payload = parts[1];
    const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
    const b64 = padded.replace(/-/g, '+').replace(/_/g, '/');
    // RN 환경에 atob 존재 (Hermes 빌트인)
    const decoded = globalThis.atob ? globalThis.atob(b64) : '';
    if (!decoded) return true;
    const obj = JSON.parse(decoded) as { exp?: number };
    if (typeof obj.exp !== 'number') return true;
    return obj.exp * 1000 < Date.now() + marginSec * 1000;
  } catch {
    return true;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: null,
    refreshToken: null,
    status: 'loading',
  });

  useEffect(() => {
    void (async () => {
      const [accessToken, refreshToken, externalId, email, nickname] = await Promise.all([
        secureStore.get('accessToken'),
        secureStore.get('refreshToken'),
        secureStore.get('userExternalId'),
        secureStore.get('userEmail'),
        secureStore.get('userNickname'),
      ]);
      if (accessToken && refreshToken && externalId && email && nickname) {
        setState({
          user: { externalId, email, nickname },
          accessToken,
          refreshToken,
          status: 'authenticated',
        });
      } else {
        setState((s) => ({ ...s, status: 'unauthenticated' }));
      }
    })();
  }, []);

  async function persist(res: AuthResponse) {
    await Promise.all([
      secureStore.set('accessToken', res.accessToken),
      secureStore.set('refreshToken', res.refreshToken),
      secureStore.set('userExternalId', res.user.externalId),
      secureStore.set('userEmail', res.user.email),
      secureStore.set('userNickname', res.user.nickname),
    ]);
    setState({
      user: res.user,
      accessToken: res.accessToken,
      refreshToken: res.refreshToken,
      status: 'authenticated',
    });
  }

  const value: AuthContextValue = useMemo(
    () => ({
      ...state,
      async register(args) {
        const res = await apiFetch<AuthResponse>('/auth/register', { method: 'POST', body: args });
        await persist(res);
      },
      async login(args) {
        const res = await apiFetch<AuthResponse>('/auth/login', { method: 'POST', body: args });
        await persist(res);
      },
      async logout() {
        const rt = state.refreshToken;
        await secureStore.clear();
        setState({ user: null, accessToken: null, refreshToken: null, status: 'unauthenticated' });
        if (rt) {
          try {
            await apiFetch('/auth/logout', { method: 'POST', refreshToken: rt });
          } catch {
            // ignore
          }
        }
      },
      async getValidAccessToken() {
        // 만료 30초 전이면 미리 refresh
        if (state.accessToken && !isJwtExpired(state.accessToken, 30)) {
          return state.accessToken;
        }
        const rt = state.refreshToken;
        if (!rt) return null;
        try {
          const res = await apiFetch<AuthResponse>('/auth/refresh', {
            method: 'POST',
            refreshToken: rt,
          });
          await persist(res);
          return res.accessToken;
        } catch (e) {
          if (e instanceof ApiError && e.status === 401) {
            await secureStore.clear();
            setState({
              user: null,
              accessToken: null,
              refreshToken: null,
              status: 'unauthenticated',
            });
          }
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
