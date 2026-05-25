import { useCallback, useRef, useState } from 'react';
import { apiFetch } from '../services/api';
import { useAuth } from '../store/auth';
import { useUnlock } from '../store/unlock';

const CHAT_SEQUENCE = [5, 3, 1, 7] as const;
const ADMIN_SEQUENCE = [7, 1, 3, 5] as const;
const ARM_TIMEOUT_MS = 8000;
const TAP_RATE_LIMIT_MS = 1000;
const WINDOW = 4; // sliding window 길이

interface VerifyResponse {
  unlockToken: string;
  expiresAt: string;
}

export interface FeedSequenceState {
  armed: boolean;
}

export type SequenceCompletion = null | { kind: 'chat' } | { kind: 'admin' };

interface FeedSequenceApi {
  state: FeedSequenceState;
  onTapWordmark(): void;
  /** position 1~7. 성공 시 'chat' 또는 'admin'. progress 중이면 null. */
  onTapArticle(position: number): Promise<SequenceCompletion>;
}

function arraysEqual(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * 위장 진입 트래커 (v2 — dual sequence).
 *
 * 마지막 4탭 sliding window 에 따라:
 *   - [5,3,1,7] → chat (sequence/verify 호출 → unlock_token)
 *   - [7,1,3,5] → admin (mobile 측 admin 화면 navigate)
 *
 * 외부 신호 0 — toast / 색상 변화 / 진동 모두 금지.
 * 유일한 신호: navigation.
 */
export function useFeedSequence(): FeedSequenceApi {
  const [state, setState] = useState<FeedSequenceState>({ armed: false });
  const armTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapTimesRef = useRef<Map<number, number>>(new Map());
  const bufferRef = useRef<number[]>([]);
  const auth = useAuth();
  const unlock = useUnlock();

  const disarm = useCallback(() => {
    if (armTimerRef.current) {
      clearTimeout(armTimerRef.current);
      armTimerRef.current = null;
    }
    bufferRef.current = [];
    setState({ armed: false });
  }, []);

  const onTapWordmark = useCallback(() => {
    setState((prev) => {
      if (prev.armed) {
        if (armTimerRef.current) clearTimeout(armTimerRef.current);
        armTimerRef.current = null;
        bufferRef.current = [];
        return { armed: false };
      }
      if (armTimerRef.current) clearTimeout(armTimerRef.current);
      bufferRef.current = [];
      armTimerRef.current = setTimeout(() => {
        // silent auto-disarm
        setState({ armed: false });
        bufferRef.current = [];
        armTimerRef.current = null;
      }, ARM_TIMEOUT_MS);
      return { armed: true };
    });
  }, []);

  const onTapArticle = useCallback(
    async (position: number): Promise<SequenceCompletion> => {
      // rate limit
      const now = Date.now();
      const lastAt = lastTapTimesRef.current.get(position);
      if (lastAt && now - lastAt < TAP_RATE_LIMIT_MS) return null;
      lastTapTimesRef.current.set(position, now);

      if (!state.armed) return null;

      // sliding window — 마지막 4 탭만 유지
      bufferRef.current.push(position);
      if (bufferRef.current.length > WINDOW) {
        bufferRef.current = bufferRef.current.slice(-WINDOW);
      }

      if (bufferRef.current.length < WINDOW) return null;

      const buf = bufferRef.current;

      // admin sequence 우선 체크
      if (arraysEqual(buf, ADMIN_SEQUENCE)) {
        disarm();
        return { kind: 'admin' };
      }

      // chat sequence
      if (arraysEqual(buf, CHAT_SEQUENCE)) {
        disarm();
        const accessToken = await auth.getValidAccessToken();
        if (!accessToken) return null;
        try {
          const res = await apiFetch<VerifyResponse>('/sequence/verify', {
            method: 'POST',
            body: { sequence: [...CHAT_SEQUENCE] },
            accessToken,
          });
          await unlock.setUnlock(res.unlockToken, res.expiresAt);
          return { kind: 'chat' };
        } catch {
          // silent
          return null;
        }
      }

      return null;
    },
    [state, disarm, auth, unlock],
  );

  return { state, onTapWordmark, onTapArticle };
}
