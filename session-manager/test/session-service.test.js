const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { cleanText, listSessions, normalizeSessionsRoot, readSessionDetail, sessionIdFrom, summarizeSession } = require('../src/session-service');
const { shellQuote, validatedSessionId } = require('../src/terminal-service');

const SESSION_ID = '019fc47b-8cd1-73e2-83f8-78957eabc9a7';

function records({ id = SESSION_ID, title = '첫 번째 요청', updated = '2026-08-03T01:05:00.000Z' } = {}) {
  return [
    { timestamp: '2026-08-03T01:00:00.000Z', type: 'session_meta', payload: { id, cwd: '/work/demo', cli_version: '0.146.0', timestamp: '2026-08-03T01:00:00.000Z', source: 'cli' } },
    { timestamp: '2026-08-03T01:00:01.000Z', type: 'event_msg', payload: { type: 'user_message', message: `<environment_context>숨길 정보</environment_context>${title}` } },
    { timestamp: updated, type: 'event_msg', payload: { type: 'agent_message', message: '작업을 완료했습니다. <code>태그는 보존</code>' } },
    { timestamp: updated, type: 'response_item', payload: { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: '중복 메시지' }] } }
  ];
}

async function writeSession(root, relativePath, data) {
  const filePath = path.join(root, relativePath);
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  await fs.promises.writeFile(filePath, `${data.map((item) => JSON.stringify(item)).join('\n')}\n잘못된-json\n`, 'utf8');
  // 테스트 실행 날짜가 세션 활동 시각보다 늦어도 정렬 결과가 바뀌지 않도록 수정 시각을 고정한다.
  const latestTimestamp = data
    .map((item) => new Date(item.timestamp))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => b - a)[0];
  if (latestTimestamp) await fs.promises.utimes(filePath, latestTimestamp, latestTimestamp);
  return filePath;
}

test('세션 요약은 메타데이터와 이벤트 메시지만 추출한다', async (t) => {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'session-manager-'));
  t.after(() => fs.promises.rm(root, { recursive: true, force: true }));
  const file = await writeSession(root, '2026/08/03/session.jsonl', records());
  const session = await summarizeSession(file);
  assert.equal(session.id, SESSION_ID);
  assert.equal(session.cwd, '/work/demo');
  assert.equal(session.title, '첫 번째 요청');
  assert.equal(session.messageCount, 2);
  assert.match(session.preview, /태그는 보존/);
  assert.match(session.searchText, /첫 번째 요청/);
  assert.match(session.searchText, /작업을 완료했습니다/);
});

test('세션 목록은 최근 활동 순서로 정렬된다', async (t) => {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'session-manager-'));
  t.after(() => fs.promises.rm(root, { recursive: true, force: true }));
  await writeSession(root, 'a.jsonl', records({ id: '11111111-1111-1111-1111-111111111111', title: '오래된 세션', updated: '2026-08-03T01:01:00.000Z' }));
  await writeSession(root, 'nested/b.jsonl', records({ id: '22222222-2222-2222-2222-222222222222', title: '최근 세션', updated: '2026-08-03T02:01:00.000Z' }));
  const sessions = await listSessions(root);
  assert.equal(sessions.length, 2);
  assert.equal(sessions[0].title, '최근 세션');
});

test('상세 대화는 사용자와 Codex 메시지를 보존한다', async (t) => {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'session-manager-'));
  t.after(() => fs.promises.rm(root, { recursive: true, force: true }));
  const file = await writeSession(root, 'session.jsonl', records());
  const detail = await readSessionDetail(file);
  assert.equal(detail.messages.length, 2);
  assert.equal(detail.messages[0].role, 'user');
  assert.equal(detail.messages[1].role, 'assistant');
  assert.match(detail.messages[1].text, /<code>태그는 보존<\/code>/);
  assert.deepEqual(Object.keys(detail.meta).sort(), ['cwd', 'id', 'timestamp']);
});

test('환경 컨텍스트는 미리보기에서 제거한다', () => {
  assert.equal(cleanText('<environment_context>secret</environment_context>사용자 요청'), '사용자 요청');
});

test('메타데이터가 없으면 파일 이름에서 UUID를 찾는다', () => {
  const file = `/tmp/rollout-2026-08-03T10-00-00-${SESSION_ID}.jsonl`;
  assert.equal(sessionIdFrom({}, file), SESSION_ID);
  assert.equal(sessionIdFrom({}, '/tmp/not-a-session.jsonl'), null);
});

test('Codex 홈을 선택하면 내부 sessions 폴더를 사용한다', async (t) => {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'session-manager-'));
  t.after(() => fs.promises.rm(root, { recursive: true, force: true }));
  const sessionsRoot = path.join(root, 'sessions');
  await fs.promises.mkdir(sessionsRoot);
  assert.equal(normalizeSessionsRoot(root), sessionsRoot);
  assert.equal(normalizeSessionsRoot(sessionsRoot), sessionsRoot);
});

test('검색 인덱스는 긴 세션의 최근 대화를 유지한다', async (t) => {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'session-manager-'));
  t.after(() => fs.promises.rm(root, { recursive: true, force: true }));
  const longRecords = records();
  for (let index = 0; index < 30; index += 1) {
    longRecords.push({ timestamp: '2026-08-03T02:00:00.000Z', type: 'event_msg', payload: { type: 'agent_message', message: `${'긴대화'.repeat(180)}-${index}` } });
  }
  longRecords.push({ timestamp: '2026-08-03T03:00:00.000Z', type: 'event_msg', payload: { type: 'user_message', message: '가장 최근의 고유 검색어' } });
  const file = await writeSession(root, 'search.jsonl', longRecords);
  const session = await summarizeSession(file);
  assert.match(session.searchText, /가장 최근의 고유 검색어/);
  assert.ok(session.searchText.length <= 12_000);
});

test('긴 세션은 최근 500개 메시지만 반환한다', async (t) => {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'session-manager-'));
  t.after(() => fs.promises.rm(root, { recursive: true, force: true }));
  const manyRecords = [{ timestamp: '2026-08-03T01:00:00.000Z', type: 'session_meta', payload: { id: SESSION_ID, cwd: '/work/demo' } }];
  for (let index = 0; index < 510; index += 1) {
    manyRecords.push({ timestamp: `2026-08-03T01:${String(index % 60).padStart(2, '0')}:00.000Z`, type: 'event_msg', payload: { type: 'user_message', message: `메시지 ${index}` } });
  }
  const file = await writeSession(root, 'long.jsonl', manyRecords);
  const detail = await readSessionDetail(file);
  assert.equal(detail.totalMessages, 510);
  assert.equal(detail.messages.length, 500);
  assert.equal(detail.messages[0].text, '메시지 10');
  assert.equal(detail.truncated, true);
});

test('파일이 변경되면 목록과 상세 캐시를 갱신한다', async (t) => {
  const root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'session-manager-'));
  t.after(() => fs.promises.rm(root, { recursive: true, force: true }));
  const file = await writeSession(root, 'cached.jsonl', records());
  const firstList = await listSessions(root);
  const firstDetail = await readSessionDetail(file);
  const added = { timestamp: '2026-08-03T03:00:00.000Z', type: 'event_msg', payload: { type: 'user_message', message: '캐시 이후 추가된 대화' } };
  await fs.promises.appendFile(file, `${JSON.stringify(added)}\n`, 'utf8');
  const secondList = await listSessions(root);
  const secondDetail = await readSessionDetail(file);
  assert.equal(firstList[0].messageCount, 2);
  assert.equal(secondList[0].messageCount, 3);
  assert.equal(firstDetail.totalMessages, 2);
  assert.equal(secondDetail.totalMessages, 3);
});

test('존재하지 않는 세션 폴더는 빈 목록으로 처리한다', async () => {
  const sessions = await listSessions(path.join(os.tmpdir(), `missing-${Date.now()}`));
  assert.deepEqual(sessions, []);
});

test('재개 명령 입력값을 검증하고 POSIX 경로를 안전하게 인용한다', () => {
  assert.equal(validatedSessionId(SESSION_ID), SESSION_ID);
  assert.throws(() => validatedSessionId('abc; rm -rf /'));
  assert.throws(() => validatedSessionId('11111111-1111-1111-1111'));
  assert.equal(shellQuote("/tmp/a'b"), "'/tmp/a'\"'\"'b'");
});
