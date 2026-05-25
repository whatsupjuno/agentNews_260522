import Constants from 'expo-constants';

export interface ApiOkEnvelope<T> {
  success: true;
  data: T;
  meta: { timestamp: string; traceId: string };
}

export interface ApiErrEnvelope {
  success: false;
  error: { code: string; message: string; details?: unknown; traceId: string };
  meta: { timestamp: string; traceId: string };
}

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

/**
 * API URL 결정 순위:
 *   1. EXPO_PUBLIC_API_BASE_URL 환경변수 (staging/production EAS build 또는 .env)
 *   2. Expo Go dev — Constants.hostUri 자동 추출 (LAN IP)
 *   3. localhost fallback
 *
 * WS URL:
 *   1. EXPO_PUBLIC_WS_URL 환경변수 (별도 host 분리 시)
 *   2. API base 의 origin (host:port) 자동 추출
 */
function resolveApiBase(): { api: string; ws: string } {
  const explicit = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (explicit && explicit.trim().length > 0) {
    const api = explicit.replace(/\/+$/, '');
    const wsEnv = process.env.EXPO_PUBLIC_WS_URL;
    const ws =
      wsEnv && wsEnv.trim().length > 0 ? wsEnv.replace(/\/+$/, '') : stripPath(api);
    return { api, ws };
  }

  const cfg = Constants as unknown as {
    expoConfig?: { hostUri?: string };
    expoGoConfig?: { debuggerHost?: string; hostUri?: string };
    manifest?: { debuggerHost?: string; hostUri?: string };
    manifest2?: { extra?: { expoClient?: { hostUri?: string } } };
    experienceUrl?: string;
    linkingUri?: string;
  };
  const candidates: Array<string | undefined> = [
    cfg.expoConfig?.hostUri,
    cfg.expoGoConfig?.debuggerHost,
    cfg.expoGoConfig?.hostUri,
    cfg.manifest?.debuggerHost,
    cfg.manifest?.hostUri,
    cfg.manifest2?.extra?.expoClient?.hostUri,
    cfg.experienceUrl?.replace(/^exp:\/\//, ''),
    cfg.linkingUri?.replace(/^exp:\/\//, ''),
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.length > 0) {
      const host = c.split(':')[0];
      if (host && host !== 'undefined' && host !== 'localhost') {
        return { api: `http://${host}:3000/api/v1`, ws: `http://${host}:3000` };
      }
    }
  }
  return { api: 'http://localhost:3000/api/v1', ws: 'http://localhost:3000' };
}

function stripPath(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return url.replace(/\/api\/v1\/?$/, '');
  }
}

const RESOLVED = resolveApiBase();
export const API_BASE = RESOLVED.api;
export const WS_BASE = RESOLVED.ws;

interface FetchOpts {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  accessToken?: string | null;
  unlockToken?: string | null;
  refreshToken?: string | null;
  signal?: AbortSignal;
}

export async function apiFetch<T>(path: string, opts: FetchOpts = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (opts.accessToken) headers['Authorization'] = `Bearer ${opts.accessToken}`;
  if (opts.unlockToken) headers['X-Unlock-Token'] = opts.unlockToken;
  if (opts.refreshToken) headers['X-Refresh-Token'] = opts.refreshToken;

  const res = await fetch(`${API_BASE}${path}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
  });

  let parsed: unknown = null;
  if (res.status !== 204) {
    try {
      parsed = await res.json();
    } catch {
      parsed = null;
    }
  }

  if (!res.ok) {
    const envelope = parsed as ApiErrEnvelope | null;
    const code = envelope?.error?.code ?? `HTTP_${res.status}`;
    const message = envelope?.error?.message ?? `HTTP ${res.status}`;
    throw new ApiError(code, message, res.status);
  }
  if (res.status === 204 || !parsed) {
    return undefined as T;
  }
  const envelope = parsed as ApiOkEnvelope<T> | T;
  if (
    envelope &&
    typeof envelope === 'object' &&
    'success' in envelope &&
    (envelope as ApiOkEnvelope<T>).success === true
  ) {
    return (envelope as ApiOkEnvelope<T>).data;
  }
  return envelope as T;
}
