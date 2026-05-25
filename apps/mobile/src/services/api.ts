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
 * Expo Go 가 자동 감지한 dev server LAN IP 를 백엔드 host 로 사용.
 * (`localhost` 는 실기기에서 동작 X)
 *
 * SDK 버전마다 노출 path 가 다름 — 여러 후보 시도.
 */
function extractHost(): string {
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
        return host;
      }
    }
  }
  return 'localhost';
}

const HOST = extractHost();
export const API_BASE = `http://${HOST}:3000/api/v1`;
export const WS_BASE = `http://${HOST}:3000`;

// 디버그 노출 (NewsFeed 임시 디버그 박스에서 사용)
export const DEBUG_INFO = {
  host: HOST,
  apiBase: API_BASE,
  rawCandidates: (() => {
    const cfg = Constants as unknown as Record<string, unknown>;
    return {
      expoConfig_hostUri: (cfg.expoConfig as { hostUri?: string } | undefined)?.hostUri,
      expoGoConfig_debuggerHost: (cfg.expoGoConfig as { debuggerHost?: string } | undefined)
        ?.debuggerHost,
      experienceUrl: cfg.experienceUrl as string | undefined,
      linkingUri: cfg.linkingUri as string | undefined,
    };
  })(),
};

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
