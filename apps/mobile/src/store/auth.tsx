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
        if (state.accessToken) return state.accessToken;
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
