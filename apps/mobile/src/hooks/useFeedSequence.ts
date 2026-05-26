import { useCallback, useRef, useState } from 'react';
import { apiFetch } from '../services/api';
import { useAuth } from '../store/auth';
import { useUnlock } from '../store/unlock';
import { getSequenceConfig } from '../services/sequenceConfig';

const ARM_TIMEOUT_MS = 8000;
const TAP_RATE_LIMIT_MS = 1000;
const WINDOW = 4;

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
  onTapArticle(position: number): Promise<SequenceCompletion>;
}

function arraysEqual(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export function useFeedSequence(): FeedSequenceApi {
  const [state, setState] = useState<FeedSequenceState>({ armed: false });
  const armTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapTimesRef = useRef<Map<number, number>>(new Map());
  const bufferRef = useRef<number[]>([]);
  const auth = useAuth();
  const unlock = useUnlock();

  // NewsFeed mount 시 항상 최신 sequence config fetch — 푸시 cold start race condition 방지
  useEffect(() => {
    void (async () => {
      const token = await auth.getValidAccessToken();
      if (token) await loadSequenceConfig(token);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        setState({ armed: false });
        bufferRef.current = [];
        armTimerRef.current = null;
      }, ARM_TIMEOUT_MS);
      return { armed: true };
    });
  }, []);

  const onTapArticle = useCallback(
    async (position: number): Promise<SequenceCompletion> => {
      const now = Date.now();
      const lastAt = lastTapTimesRef.current.get(position);
      if (lastAt && now - lastAt < TAP_RATE_LIMIT_MS) return null;
      lastTapTimesRef.current.set(position, now);

      if (!state.armed) return null;

      bufferRef.current.push(position);
      if (bufferRef.current.length > WINDOW) {
        bufferRef.current = bufferRef.current.slice(-WINDOW);
      }

      if (bufferRef.current.length < WINDOW) return null;

      const buf = bufferRef.current;
      const { chat, admin } = getSequenceConfig();

      if (arraysEqual(buf, admin)) {
        disarm();
        return { kind: 'admin' };
      }

      if (arraysEqual(buf, chat)) {
        disarm();
        const accessToken = await auth.getValidAccessToken();
        if (!accessToken) return null;
        try {
          const res = await apiFetch<VerifyResponse>('/sequence/verify', {
            method: 'POST',
            body: { sequence: chat },
            accessToken,
          });
          await unlock.setUnlock(res.unlockToken, res.expiresAt);
          return { kind: 'chat' };
        } catch {
          return null;
        }
      }

      return null;
    },
    [state, disarm, auth, unlock],
  );

  return { state, onTapWordmark, onTapArticle };
}
