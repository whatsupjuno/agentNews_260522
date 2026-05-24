import { useCallback, useRef, useState } from 'react';
import { apiFetch } from '../services/api';
import { useAuth } from '../store/auth';
import { useUnlock } from '../store/unlock';

const TRIGGER_SEQUENCE = [5, 3, 1, 7] as const;
const ARM_TIMEOUT_MS = 8000;
const TAP_RATE_LIMIT_MS = 1000;

interface VerifyResponse {
  unlockToken: string;
  expiresAt: string;
}

export interface FeedSequenceState {
  armed: boolean;
  /** 0..3 — 4 가 되면 즉시 verify 후 0 으로 reset */
  progress: 0 | 1 | 2 | 3;
}

interface FeedSequenceApi {
  state: FeedSequenceState;
  onTapWordmark(): void;
  /** position = 카드 feedIndex (1..N). 성공 시 true (= ArticleDetailScreen chat 모드로 진입할 신호) */
  onTapArticle(position: number): Promise<boolean>;
}

/**
 * 위장 진입 트래커 — handoff §8.3 갱신본 (toast 금지).
 *
 * 외부 신호 0 — 워드마크 탭 / 카드 오탭 reset / auto-disarm 모두 silent.
 * 유일한 외부 신호는 시퀀스 완성 시 navigation 으로 ArticleDetailScreen chat 모드 진입.
 */
export function useFeedSequence(): FeedSequenceApi {
  const [state, setState] = useState<FeedSequenceState>({ armed: false, progress: 0 });
  const armTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapTimesRef = useRef<Map<number, number>>(new Map());
  const auth = useAuth();
  const unlock = useUnlock();

  const disarm = useCallback(() => {
    if (armTimerRef.current) {
      clearTimeout(armTimerRef.current);
      armTimerRef.current = null;
    }
    setState({ armed: false, progress: 0 });
  }, []);

  const onTapWordmark = useCallback(() => {
    setState((prev) => {
      if (prev.armed) {
        if (armTimerRef.current) clearTimeout(armTimerRef.current);
        armTimerRef.current = null;
        return { armed: false, progress: 0 };
      }
      if (armTimerRef.current) clearTimeout(armTimerRef.current);
      armTimerRef.current = setTimeout(() => {
        // silent auto-disarm (handoff v2 §12)
        setState({ armed: false, progress: 0 });
        armTimerRef.current = null;
      }, ARM_TIMEOUT_MS);
      return { armed: true, progress: 0 };
    });
  }, []);

  const onTapArticle = useCallback(
    async (position: number): Promise<boolean> => {
      // rate limit (REQ-007): 1초 내 동일 position 무시
      const now = Date.now();
      const lastAt = lastTapTimesRef.current.get(position);
      if (lastAt && now - lastAt < TAP_RATE_LIMIT_MS) {
        return false;
      }
      lastTapTimesRef.current.set(position, now);

      if (!state.armed) return false;

      const expected = TRIGGER_SEQUENCE[state.progress];
      if (position !== expected) {
        // silent reset. 단 #5 면 새 시작 (handoff §8.3)
        setState((prev) => ({
          ...prev,
          progress: position === TRIGGER_SEQUENCE[0] ? 1 : 0,
        }));
        return false;
      }

      const nextProgress = state.progress + 1;
      if (nextProgress < TRIGGER_SEQUENCE.length) {
        setState((prev) => ({ ...prev, progress: nextProgress as 1 | 2 | 3 }));
        return false;
      }

      // 시퀀스 완성 — verify 호출
      disarm();
      const accessToken = await auth.getValidAccessToken();
      if (!accessToken) return false;
      try {
        const res = await apiFetch<VerifyResponse>('/sequence/verify', {
          method: 'POST',
          body: { sequence: [...TRIGGER_SEQUENCE] },
          accessToken,
        });
        await unlock.setUnlock(res.unlockToken, res.expiresAt);
        return true;
      } catch {
        // silent — 외부 noise 0
        return false;
      }
    },
    [state, disarm, auth, unlock],
  );

  return { state, onTapWordmark, onTapArticle };
}
