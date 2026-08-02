const ui = {
  sessionCount: document.querySelector('#sessionCount'),
  sessionList: document.querySelector('#sessionList'),
  searchInput: document.querySelector('#searchInput'),
  refreshButton: document.querySelector('#refreshButton'),
  folderButton: document.querySelector('#folderButton'),
  platformBadge: document.querySelector('#platformBadge'),
  emptyState: document.querySelector('#emptyState'),
  detailView: document.querySelector('#detailView'),
  detailTitle: document.querySelector('#detailTitle'),
  detailDate: document.querySelector('#detailDate'),
  detailMessages: document.querySelector('#detailMessages'),
  detailCwd: document.querySelector('#detailCwd'),
  detailId: document.querySelector('#detailId'),
  resumeButton: document.querySelector('#resumeButton'),
  copyIdButton: document.querySelector('#copyIdButton'),
  conversation: document.querySelector('#conversation'),
  truncatedNotice: document.querySelector('#truncatedNotice'),
  codexStatus: document.querySelector('#codexStatus'),
  connectionDot: document.querySelector('#connectionDot'),
  sessionsPath: document.querySelector('#sessionsPath'),
  toast: document.querySelector('#toast')
};

const PAGE_SIZE = 80;
const state = { sessions: [], selectedId: null, query: '', sort: 'updated', detailRequest: 0, visibleLimit: PAGE_SIZE };

function formatDate(value, long = false) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '날짜 미상';
  if (long) return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', minute: '2-digit' }).format(date);
  return new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric' }).format(date);
}

function folderName(value) {
  if (!value) return '경로 없음';
  return value.split(/[\\/]/).filter(Boolean).pop() || value;
}

function shortId(value) { return value ? `${value.slice(0, 8)}…${value.slice(-4)}` : '—'; }

function filteredSessions() {
  const query = state.query.trim().toLocaleLowerCase();
  return state.sessions
    .filter((session) => !query || [session.title, session.preview, session.cwd, session.id].some((value) => String(value).toLocaleLowerCase().includes(query)))
    .sort((a, b) => new Date(state.sort === 'created' ? b.createdAt : b.updatedAt) - new Date(state.sort === 'created' ? a.createdAt : a.updatedAt));
}

function showToast(message, error = false) {
  ui.toast.textContent = message;
  ui.toast.classList.toggle('error', error);
  ui.toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => ui.toast.classList.remove('show'), 2800);
}

function renderList({ resetScroll = false } = {}) {
  const sessions = filteredSessions();
  const previousScroll = resetScroll ? 0 : ui.sessionList.scrollTop;
  ui.sessionList.replaceChildren();
  ui.sessionCount.textContent = state.query ? `${sessions.length}개 검색 결과` : `${state.sessions.length}개 세션`;
  if (!sessions.length) {
    const message = document.createElement('div');
    message.className = 'list-message';
    message.textContent = state.query ? '검색 결과가 없습니다.' : '저장된 세션이 없습니다.\nCodex CLI에서 대화를 시작해 보세요.';
    ui.sessionList.append(message);
    return;
  }

  for (const session of sessions.slice(0, state.visibleLimit)) {
    const card = document.createElement('button');
    card.className = `session-card${session.id === state.selectedId ? ' selected' : ''}`;
    card.type = 'button';
    card.role = 'option';
    card.ariaSelected = String(session.id === state.selectedId);
    card.dataset.sessionId = session.id;

    const top = document.createElement('div'); top.className = 'card-top';
    const cwd = document.createElement('span'); cwd.className = 'cwd-badge'; cwd.textContent = `⌁ ${folderName(session.cwd)}`; cwd.title = session.cwd;
    const date = document.createElement('time'); date.className = 'card-date'; date.textContent = formatDate(session.updatedAt); date.dateTime = session.updatedAt;
    top.append(cwd, date);
    const title = document.createElement('h3'); title.textContent = session.title;
    const preview = document.createElement('p'); preview.textContent = session.preview || '대화 미리보기가 없습니다.';
    const bottom = document.createElement('div'); bottom.className = 'card-bottom';
    const count = document.createElement('span'); count.className = 'message-count'; count.textContent = `${session.messageCount} messages`;
    const id = document.createElement('span'); id.className = 'session-id-short'; id.textContent = shortId(session.id);
    bottom.append(count, id); card.append(top, title, preview, bottom);
    card.addEventListener('click', () => selectSession(session.id));
    ui.sessionList.append(card);
  }
  if (sessions.length > state.visibleLimit) {
    const remaining = sessions.length - state.visibleLimit;
    const loadMore = document.createElement('button');
    loadMore.type = 'button';
    loadMore.className = 'load-more';
    loadMore.textContent = `다음 ${Math.min(PAGE_SIZE, remaining)}개 보기 · ${remaining}개 남음`;
    loadMore.addEventListener('click', () => { state.visibleLimit += PAGE_SIZE; renderList(); });
    ui.sessionList.append(loadMore);
  }
  ui.sessionList.scrollTop = previousScroll;
}

async function selectSession(sessionId, shouldScroll = false) {
  if (!sessionId) return;
  state.selectedId = sessionId;
  renderList();
  if (shouldScroll) ui.sessionList.querySelector('.selected')?.scrollIntoView({ block: 'nearest' });
  const session = state.sessions.find((item) => item.id === sessionId);
  ui.emptyState.classList.add('hidden');
  ui.detailView.classList.remove('hidden');
  ui.detailTitle.textContent = session.title;
  ui.detailDate.textContent = formatDate(session.updatedAt, true);
  ui.detailMessages.textContent = `${session.messageCount}개 메시지`;
  ui.detailCwd.textContent = session.cwd || '저장된 작업 경로 없음';
  ui.detailCwd.title = session.cwd || '';
  ui.detailId.textContent = session.id;
  ui.conversation.innerHTML = '<div class="detail-loading">대화를 불러오는 중…</div>';
  ui.truncatedNotice.classList.add('hidden');

  const requestId = ++state.detailRequest;
  try {
    const detail = await window.sessionManager.getSessionDetail(sessionId);
    if (requestId !== state.detailRequest) return;
    renderConversation(detail.messages);
    ui.truncatedNotice.classList.toggle('hidden', !detail.truncated);
  } catch (error) {
    if (requestId !== state.detailRequest) return;
    ui.conversation.innerHTML = '';
    const message = document.createElement('div'); message.className = 'list-message'; message.textContent = `대화를 열 수 없습니다.\n${error.message}`; ui.conversation.append(message);
  }
}

function renderConversation(messages) {
  ui.conversation.replaceChildren();
  if (!messages.length) {
    const empty = document.createElement('div'); empty.className = 'list-message'; empty.textContent = '표시할 대화 메시지가 없습니다.'; ui.conversation.append(empty); return;
  }
  const fragment = document.createDocumentFragment();
  for (const item of messages) {
    const message = document.createElement('article'); message.className = `message ${item.role}`;
    const avatar = document.createElement('div'); avatar.className = 'avatar'; avatar.textContent = item.role === 'user' ? 'ME' : 'CX';
    const body = document.createElement('div');
    const head = document.createElement('div'); head.className = 'message-head';
    const author = document.createElement('strong'); author.textContent = item.role === 'user' ? '나' : 'Codex';
    const time = document.createElement('time'); time.textContent = item.timestamp ? formatDate(item.timestamp, true) : '';
    const text = document.createElement('pre'); text.className = 'message-text'; text.textContent = item.text;
    head.append(author, time); body.append(head, text); message.append(avatar, body); fragment.append(message);
  }
  ui.conversation.append(fragment);
  ui.conversation.scrollTop = 0;
}

async function loadSessions({ keepSelection = true } = {}) {
  ui.refreshButton.disabled = true;
  ui.sessionCount.textContent = '불러오는 중';
  ui.sessionList.innerHTML = '<div class="list-message">세션 파일을 분석하는 중…</div>';
  try {
    const sessions = await window.sessionManager.listSessions();
    state.sessions = sessions;
    state.visibleLimit = PAGE_SIZE;
    if (!keepSelection || !sessions.some((item) => item.id === state.selectedId)) state.selectedId = sessions[0]?.id || null;
    renderList();
    if (state.selectedId) await selectSession(state.selectedId);
    else { ui.emptyState.classList.remove('hidden'); ui.detailView.classList.add('hidden'); }
  } catch (error) {
    state.sessions = [];
    ui.sessionCount.textContent = '불러오기 실패';
    ui.sessionList.innerHTML = '';
    const message = document.createElement('div'); message.className = 'list-message'; message.textContent = `세션 폴더를 읽을 수 없습니다.\n${error.message}`; ui.sessionList.append(message);
    showToast('세션 목록을 불러오지 못했습니다.', true);
  } finally { ui.refreshButton.disabled = false; }
}

async function updateAppInfo() {
  const info = await window.sessionManager.getAppInfo();
  const names = { darwin: 'macOS', win32: 'WINDOWS', linux: 'LINUX' };
  ui.platformBadge.textContent = names[info.platform] || info.platform.toUpperCase();
  ui.sessionsPath.textContent = info.sessionsRoot;
  ui.sessionsPath.title = info.sessionsRoot;
  ui.connectionDot.className = `status-dot ${info.codexPath ? 'ok' : 'error'}`;
  ui.codexStatus.textContent = info.codexPath ? 'Codex CLI 연결됨' : 'Codex CLI를 찾을 수 없음';
}

async function resumeSelected() {
  if (!state.selectedId) return;
  ui.resumeButton.disabled = true;
  try {
    await window.sessionManager.resumeSession(state.selectedId);
    showToast('새 터미널에서 Codex 세션을 열었습니다.');
  } catch (error) { showToast(error.message || '세션을 열지 못했습니다.', true); }
  finally { ui.resumeButton.disabled = false; }
}

function moveSelection(direction) {
  const sessions = filteredSessions();
  if (!sessions.length) return;
  let index = sessions.findIndex((item) => item.id === state.selectedId);
  index = Math.max(0, Math.min(sessions.length - 1, index + direction));
  if (index >= state.visibleLimit) state.visibleLimit = Math.ceil((index + 1) / PAGE_SIZE) * PAGE_SIZE;
  selectSession(sessions[index].id, true);
}

function jumpSelection(target) {
  const sessions = filteredSessions();
  if (!sessions.length) return;
  const index = target === 'first' ? 0 : sessions.length - 1;
  if (index >= state.visibleLimit) state.visibleLimit = sessions.length;
  selectSession(sessions[index].id, true);
}

ui.searchInput.addEventListener('input', (event) => { state.query = event.target.value; state.visibleLimit = PAGE_SIZE; renderList({ resetScroll: true }); });
ui.refreshButton.addEventListener('click', () => loadSessions());
ui.resumeButton.addEventListener('click', resumeSelected);
ui.copyIdButton.addEventListener('click', async () => { if (state.selectedId) { await window.sessionManager.copyText(state.selectedId); showToast('세션 ID를 복사했습니다.'); } });
ui.folderButton.addEventListener('click', async () => { const selected = await window.sessionManager.chooseSessionsFolder(); if (selected) { await updateAppInfo(); await loadSessions({ keepSelection: false }); } });
document.querySelectorAll('.sort-button').forEach((button) => button.addEventListener('click', () => {
  state.sort = button.dataset.sort;
  document.querySelectorAll('.sort-button').forEach((item) => item.classList.toggle('active', item === button));
  renderList({ resetScroll: true });
}));
ui.sessionList.addEventListener('scroll', () => {
  const nearBottom = ui.sessionList.scrollTop + ui.sessionList.clientHeight >= ui.sessionList.scrollHeight - 120;
  const total = filteredSessions().length;
  if (nearBottom && state.visibleLimit < total) { state.visibleLimit += PAGE_SIZE; renderList(); }
}, { passive: true });
document.addEventListener('keydown', (event) => {
  const typing = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);
  if (event.key === '/' && !typing) { event.preventDefault(); ui.searchInput.focus(); }
  else if (event.key === 'Escape' && typing) { ui.searchInput.value = ''; state.query = ''; ui.searchInput.blur(); renderList(); }
  else if (event.key === 'ArrowDown' && !typing) { event.preventDefault(); moveSelection(1); }
  else if (event.key === 'ArrowUp' && !typing) { event.preventDefault(); moveSelection(-1); }
  else if (event.key === 'PageDown' && !typing) { event.preventDefault(); moveSelection(8); }
  else if (event.key === 'PageUp' && !typing) { event.preventDefault(); moveSelection(-8); }
  else if (event.key === 'Home' && !typing) { event.preventDefault(); jumpSelection('first'); }
  else if (event.key === 'End' && !typing) { event.preventDefault(); jumpSelection('last'); }
  else if (event.key === 'Enter' && !typing) { event.preventDefault(); resumeSelected(); }
  else if (event.key.toLowerCase() === 'r' && !typing) loadSessions();
});

Promise.all([updateAppInfo(), loadSessions({ keepSelection: false })]);
