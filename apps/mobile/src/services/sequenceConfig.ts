import { apiFetch } from './api';

interface SequenceConfig {
  chat: number[];
  admin: number[];
}

const DEFAULT_CONFIG: SequenceConfig = {
  chat: [5, 3, 1, 7],
  admin: [7, 1, 3, 5],
};

let cached: SequenceConfig = { ...DEFAULT_CONFIG };

/** 로그인 후 한 번 호출. 실패 시 default 유지. */
export async function loadSequenceConfig(accessToken: string): Promise<void> {
  try {
    const c = await apiFetch<SequenceConfig>('/sequence/config', { accessToken });
    if (Array.isArray(c.chat) && c.chat.length >= 4 && Array.isArray(c.admin) && c.admin.length >= 4) {
      cached = { chat: [...c.chat], admin: [...c.admin] };
    }
  } catch {
    // silent — default 유지
  }
}

export function getSequenceConfig(): SequenceConfig {
  return { chat: [...cached.chat], admin: [...cached.admin] };
}

/** Admin 이 변경 후 호출 — 즉시 mobile cache 갱신 */
export function setSequenceConfigLocal(config: SequenceConfig): void {
  cached = { chat: [...config.chat], admin: [...config.admin] };
}
