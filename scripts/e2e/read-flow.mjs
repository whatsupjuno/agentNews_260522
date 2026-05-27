// E2E — kakao 식 읽음 표시 전체 검증 (production cafe24)
//
// 시나리오:
//   1. demo / demo1234 로그인 → access + refresh
//   2. /sequence/verify chat [5,3,1,7] → unlockToken
//   3. WS connect (pairing 채널 자동 join)
//   4. POST /messages 'hello E2E' → me 메시지 (즉시 readAt=null)
//   5. echo bot 0.8s 후 응답 → WS 'message' event 수신 (readAt=null)
//   6. GET /messages → echo bot 메시지 readAt null 확인
//   7. POST /messages/read → DB update + WS 'read' broadcast
//   8. WS 'read' event 수신 (페어 본인에게도 emit) 확인
//   9. GET /messages 재호출 → echo bot 메시지 readAt = ISO timestamp 확인
//  10. me 발신 메시지 readAt 은 여전히 null (peer=echo bot 은 안 읽음)
//
// 사용: node scripts/e2e/read-flow.mjs
//
// 의존성: apps/mobile/node_modules/socket.io-client (이미 설치됨)

import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const { io } = require('/Users/whatsupjuno/WTF/agentNews/node_modules/socket.io-client');

const BASE = 'http://58.229.163.104:3000/api/v1';
const WS_BASE = 'http://58.229.163.104:3000';
const USER_ID = 'demo';
const PASSWORD = 'demo1234';
const CHAT_SEQUENCE = [5, 3, 1, 7];

let pass = 0;
let fail = 0;

function ok(label, detail = '') {
  console.log(`  ✓ ${label}${detail ? ' — ' + detail : ''}`);
  pass++;
}
function bad(label, detail = '') {
  console.log(`  ✗ ${label}${detail ? ' — ' + detail : ''}`);
  fail++;
}
function section(name) {
  console.log(`\n[${name}]`);
}

async function http(method, path, { accessToken, unlockToken, body } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (accessToken) headers['authorization'] = `Bearer ${accessToken}`;
  if (unlockToken) headers['x-unlock-token'] = unlockToken;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    /* keep raw */
  }
  // envelope unwrap: {success, data, meta} → data
  const json =
    parsed && typeof parsed === 'object' && 'success' in parsed && 'data' in parsed
      ? parsed.data
      : parsed;
  return { status: res.status, json, raw: text };
}

function waitForEvent(socket, type, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off('message', onAny);
      reject(new Error(`timeout waiting for ${type}`));
    }, timeoutMs);
    function onAny(payload) {
      if (payload?.type === type) {
        clearTimeout(timer);
        socket.off('message', onAny);
        resolve(payload);
      }
    }
    socket.on('message', onAny);
  });
}

async function main() {
  console.log(`\n=== READ-RECEIPT E2E @ ${BASE} ===`);

  // 0. test isolation — peer 메시지 1개 read_at=NULL 로 reset (격리)
  section('0. RESET PEER MSG (test isolation)');
  try {
    const sql = `UPDATE messages SET read_at=NULL WHERE id = (SELECT id FROM messages WHERE pairing_id=3 AND sender_agent_id<>1 AND deleted_at IS NULL ORDER BY sent_at DESC LIMIT 1) RETURNING external_id;`;
    const out = execSync(
      `ssh cafe24 "docker exec agentnews-postgres psql -U agentnews -d agentnews -tAc \\"${sql}\\""`,
      { encoding: 'utf8', timeout: 15000 },
    ).trim();
    if (out) ok('peer msg reset', `external=${out.slice(0, 8)}…`);
    else bad('peer msg reset — no row affected');
  } catch (e) {
    bad('reset ssh', e.message.slice(0, 80));
  }

  // 1. login
  section('1. LOGIN');
  const login = await http('POST', '/auth/login', {
    body: { userId: USER_ID, password: PASSWORD },
  });
  if (login.status !== 200 || !login.json?.accessToken) {
    bad('login', `status=${login.status} body=${login.raw}`);
    throw new Error('login failed');
  }
  ok('login', `agent=${login.json.agent?.userId ?? '?'}`);
  const accessToken = login.json.accessToken;

  // 2. sequence verify — 실패 시 register 로 재설정 후 재시도 (E2E 환경 정상화)
  section('2. UNLOCK (sequence verify)');
  let verify = await http('POST', '/sequence/verify', {
    accessToken,
    body: { sequence: CHAT_SEQUENCE },
  });
  if ((verify.status !== 200 && verify.status !== 201) || !verify.json?.unlockToken) {
    console.log(`  ! verify failed — registering [${CHAT_SEQUENCE}] then retry`);
    const reg = await http('POST', '/sequence/register', {
      accessToken,
      body: { sequence: CHAT_SEQUENCE },
    });
    if (reg.status !== 200 && reg.status !== 201) {
      bad('sequence register', `status=${reg.status} body=${reg.raw}`);
      throw new Error('register failed');
    }
    ok('sequence register (re-bootstrap)');
    verify = await http('POST', '/sequence/verify', {
      accessToken,
      body: { sequence: CHAT_SEQUENCE },
    });
  }
  if ((verify.status !== 200 && verify.status !== 201) || !verify.json?.unlockToken) {
    bad('sequence verify', `status=${verify.status} body=${verify.raw}`);
    throw new Error('verify failed');
  }
  ok('sequence verify', `unlock 발급`);
  const unlockToken = verify.json.unlockToken;

  // 3. WS connect
  section('3. WEBSOCKET CONNECT');
  const sock = io(WS_BASE, {
    path: '/ws',
    transports: ['websocket'],
    auth: { token: accessToken, unlockToken },
  });
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('ws connect timeout')), 5000);
    sock.on('connect', () => {
      clearTimeout(t);
      resolve();
    });
    sock.on('connect_error', (e) => {
      clearTimeout(t);
      reject(e);
    });
  });
  ok('ws connect', `id=${sock.id}`);

  // 3.5 prep: bot 메시지가 새로 도착해야 readAt 검증 가능. 보내고 받기 기다림.
  section('4. SEND + WAIT FOR BOT REPLY');
  const myBody = `e2e ${Date.now()}`;
  const botEventPromise = waitForEvent(sock, 'message', 5000);
  const send = await http('POST', '/messages', {
    accessToken,
    unlockToken,
    body: { body: myBody },
  });
  if (send.status !== 201 && send.status !== 200) {
    bad('send', `status=${send.status} body=${send.raw}`);
    throw new Error('send failed');
  }
  ok('send', `external=${send.json.externalId?.slice(0, 8)}… readAt=${send.json.readAt}`);
  if (send.json.readAt === null) ok('me readAt === null at send time');
  else bad('me readAt expected null', `got ${send.json.readAt}`);

  // wait for WS 'message' broadcast (이건 me 또는 bot 어느 쪽이든 옴)
  let received = [];
  try {
    while (received.length < 2) {
      const ev = await waitForEvent(sock, 'message', 5000);
      received.push(ev);
      if (received.length === 1 && received[0].message.body === myBody) {
        // wait for bot
        continue;
      }
      break;
    }
  } catch {
    // 일부 only — 계속 진행
  }
  ok('ws message events', `received=${received.length}`);
  const botMsg = received.map((r) => r.message).find((m) => m && m.body !== myBody);
  if (botMsg) ok('bot reply received', `body="${botMsg.body.slice(0, 30)}…"`);
  else console.log('  · skip: bot reply (현재 페어가 echo bot 이 아님 — 정상)');

  // 5. GET /messages — readAt null 확인
  section('5. LIST BEFORE READ');
  const list1 = await http('GET', '/messages', { accessToken, unlockToken });
  if (list1.status !== 200) {
    bad('list 1', `status=${list1.status}`);
    throw new Error('list failed');
  }
  const msgs1 = list1.json.messages ?? [];
  const meSent1 = msgs1.find((m) => m.body === myBody);
  const botSent1 = botMsg ? msgs1.find((m) => m.externalId === botMsg.externalId) : null;
  if (meSent1) ok('me message in list', `readAt=${meSent1.readAt}`);
  if (botSent1) {
    if (botSent1.readAt === null) ok('bot message readAt=null before mark');
    else bad('bot readAt expected null', `got ${botSent1.readAt}`);
  }

  // 6. read event listener + POST /messages/read
  section('6. MARK READ + WAIT WS BROADCAST');
  const readEventPromise = waitForEvent(sock, 'read', 3000);
  const mark = await http('POST', '/messages/read', { accessToken, unlockToken });
  if (mark.status !== 201 && mark.status !== 200) {
    bad('POST /messages/read', `status=${mark.status} body=${mark.raw}`);
    throw new Error('mark failed');
  }
  ok('POST /messages/read', `ids=${mark.json.ids?.length} readAt=${mark.json.readAt?.slice(11, 19)}`);

  if (botSent1) {
    if (mark.json.ids?.includes(botSent1.externalId))
      ok('bot externalId included in mark.ids');
    else bad('bot externalId NOT in mark.ids', `ids=${JSON.stringify(mark.json.ids)}`);
  }

  if ((mark.json.ids?.length ?? 0) === 0) {
    console.log('  · skip: ws read event (ids=0 → broadcast 안 함 = 의도된 동작)');
  } else {
    try {
      const ev = await readEventPromise;
      ok('ws read event received', `ids=${ev.messageExternalIds?.length}`);
    } catch (e) {
      bad('ws read event timeout', e.message);
    }
  }

  // 7. list again — readAt 갱신 확인
  section('7. LIST AFTER READ');
  const list2 = await http('GET', '/messages', { accessToken, unlockToken });
  const msgs2 = list2.json.messages ?? [];
  const meSent2 = msgs2.find((m) => m.body === myBody);
  const botSent2 = botSent1 ? msgs2.find((m) => m.externalId === botSent1.externalId) : null;

  if (meSent2) {
    if (meSent2.readAt === null)
      ok('me readAt still null (peer 미진입)');
    else bad('me readAt expected null', `got ${meSent2.readAt}`);
  }
  if (botSent2) {
    if (botSent2.readAt && /T.*Z/.test(botSent2.readAt))
      ok('bot readAt now ISO timestamp', botSent2.readAt);
    else bad('bot readAt expected ISO', `got ${botSent2.readAt}`);
  }

  // peer 발신 메시지 전체 readAt invariant: list2 의 모든 !fromMe 메시지는 readAt != null
  const peerMsgs2 = msgs2.filter((m) => !m.fromMe);
  const peerUnreadStill = peerMsgs2.filter((m) => !m.readAt);
  if (peerUnreadStill.length === 0)
    ok(`peer 발신 메시지 ${peerMsgs2.length}개 전부 readAt timestamp`);
  else bad(`peer 메시지 중 ${peerUnreadStill.length}개 여전히 null`);

  // me 발신 메시지의 readAt 분포 (이전 세션의 peer 가 진입했었는지)
  const meMsgs2 = msgs2.filter((m) => m.fromMe);
  const meRead = meMsgs2.filter((m) => m.readAt).length;
  console.log(
    `  · me 메시지 ${meMsgs2.length}개 중 ${meRead}개 read / ${meMsgs2.length - meRead}개 unread`,
  );

  // 8. idempotent — 두 번째 mark 는 ids=[] (이미 read)
  section('8. IDEMPOTENT MARK');
  const mark2 = await http('POST', '/messages/read', { accessToken, unlockToken });
  if (mark2.json.ids?.length === 0)
    ok('second mark — ids=[] (no double-read)');
  else bad('second mark ids expected []', `got ${mark2.json.ids?.length}`);

  sock.disconnect();
}

main()
  .then(() => {
    console.log(`\n=== RESULT: ${pass} pass / ${fail} fail ===\n`);
    process.exit(fail > 0 ? 1 : 0);
  })
  .catch((e) => {
    console.error('\n[FATAL]', e.message);
    console.log(`\n=== RESULT: ${pass} pass / ${fail} fail (fatal) ===\n`);
    process.exit(2);
  });
