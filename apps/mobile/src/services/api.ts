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
 */
function getBaseHost(): string {
  const hostUri =
    (Constants.expoConfig as { hostUri?: string } | null)?.hostUri ??
    (Constants as unknown as { expoGoConfig?: { hostUri?: string } }).expoGoConfig?.hostUri ??
    '';
  if (hostUri) {
    const host = hostUri.split(':')[0];
    if (host) return host;
  }
  return 'localhost';
}

export const API_BASE = `http://${getBaseHost()}:3000/api/v1`;
export const WS_BASE = `http://${getBaseHost()}:3000`;

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
  if (envelope && typeof envelope === 'object' && 'success' in envelope && (envelope as ApiOkEnvelope<T>).success === true) {
    return (envelope as ApiOkEnvelope<T>).data;
  }
  return envelope as T;
}
