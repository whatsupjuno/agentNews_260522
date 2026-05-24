import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { apiFetch, WS_BASE } from '../services/api';
import { useAuth } from '../store/auth';
import { useUnlock } from '../store/unlock';

export interface ChatMessage {
  externalId: string;
  pairingExternalId: string;
  senderExternalId: string;
  senderNickname: string;
  body: string;
  hasAttachment: boolean;
  sentAt: string;
  fromMe?: boolean;
}

interface UseChatApi {
  messages: ChatMessage[];
  send(body: string): Promise<void>;
  loading: boolean;
}

export function useChat(): UseChatApi {
  const auth = useAuth();
  const unlock = useUnlock();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const socketRef = useRef<Socket | null>(null);

  // 1. 메시지 history fetch
  useEffect(() => {
    void (async () => {
      const access = await auth.getValidAccessToken();
      if (!access || !unlock.token) {
        setLoading(false);
        return;
      }
      try {
        const res = await apiFetch<{ messages: ChatMessage[] }>('/messages', {
          accessToken: access,
          unlockToken: unlock.token,
        });
        const myExtId = auth.user?.externalId;
        setMessages(
          (res.messages ?? []).map((m) => ({
            ...m,
            fromMe: m.senderExternalId === myExtId,
          })),
        );
      } catch {
        // silent — 위장
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. WebSocket subscribe — 새 댓글 push 받기.
  // unlock token 이 있어야만 연결. 만료/해제 시 즉시 disconnect (위장 복귀).
  useEffect(() => {
    if (!auth.accessToken || !unlock.token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }
    const sock = io(WS_BASE, {
      path: '/ws',
      auth: { token: auth.accessToken, unlockToken: unlock.token },
      transports: ['websocket'],
    });
    socketRef.current = sock;
    sock.on('message', (payload: { type: string; message: ChatMessage }) => {
      if (payload?.type !== 'message') return;
      const m = payload.message;
      const myExtId = auth.user?.externalId;
      setMessages((prev) => {
        if (prev.find((p) => p.externalId === m.externalId)) return prev;
        return [...prev, { ...m, fromMe: m.senderExternalId === myExtId }];
      });
    });
    return () => {
      sock.disconnect();
      socketRef.current = null;
    };
  }, [auth.accessToken, auth.user?.externalId, unlock.token]);

  const send = useCallback(
    async (body: string) => {
      if (!body.trim()) return;
      const access = await auth.getValidAccessToken();
      if (!access || !unlock.token) return;
      try {
        await apiFetch('/messages', {
          method: 'POST',
          body: { body },
          accessToken: access,
          unlockToken: unlock.token,
        });
        // 즉시 보이게 — WebSocket 메시지로도 도착하지만 dedup 됨
      } catch {
        // silent
      }
    },
    [auth, unlock.token],
  );

  return { messages, send, loading };
}
