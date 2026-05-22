import type { AgentStatus } from '../constants/status';

/** 외부 노출 agent profile — 이메일 미포함 (SEC-004, dev_conventions §7-14) */
export interface AgentPublicProfile {
  externalId: string;
  nickname: string;
  status: AgentStatus;
}

/** 본인 응답에만 포함 (settings / me) */
export interface AgentSelfProfile extends AgentPublicProfile {
  email: string;
  createdAt: string;
}

export interface AuthTokenPair {
  accessToken: string;
  refreshToken: string;
}

/** unlock_token 은 별도 헤더 (`X-Unlock-Token`) — 발급 직후 응답 데이터에만 포함 */
export interface UnlockTokenResponse {
  unlockToken: string;
  expiresAt: string;
}
