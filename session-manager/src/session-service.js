const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');

const MAX_MESSAGE_LENGTH = 20_000;
const MAX_DETAIL_MESSAGES = 500;
const summaryCache = new Map();

function cleanText(value) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<environment_context>[\s\S]*?<\/environment_context>/gi, '')
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function shorten(text, max = 180) {
  const compact = cleanText(text).replace(/\s+/g, ' ');
  return compact.length > max ? `${compact.slice(0, max - 1)}…` : compact;
}

function messageFromRecord(record) {
  if (record?.type !== 'event_msg') return null;
  const payload = record.payload || {};
  if (payload.type === 'user_message') {
    const text = cleanText(payload.message);
    return text ? { role: 'user', text, timestamp: record.timestamp || null } : null;
  }
  if (payload.type === 'agent_message') {
    const text = cleanText(payload.message);
    return text ? { role: 'assistant', text, timestamp: record.timestamp || null } : null;
  }
  return null;
}

async function listJsonlFiles(root) {
  const found = [];
  async function walk(directory) {
    let entries;
    try {
      entries = await fs.promises.readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (error.code === 'ENOENT') return;
      throw error;
    }
    await Promise.all(entries.map(async (entry) => {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(fullPath);
      else if (entry.isFile() && entry.name.endsWith('.jsonl')) found.push(fullPath);
    }));
  }
  await walk(root);
  return found;
}

async function readLines(filePath, onRecord) {
  const input = fs.createReadStream(filePath, { encoding: 'utf8' });
  const lines = readline.createInterface({ input, crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line.trim()) continue;
    try {
      await onRecord(JSON.parse(line));
    } catch (error) {
      if (error instanceof SyntaxError) continue;
      throw error;
    }
  }
}

async function summarizeSession(filePath) {
  const stat = await fs.promises.stat(filePath);
  let meta = {};
  let firstUser = '';
  let lastMessage = '';
  let messageCount = 0;
  let lastTimestamp = null;

  await readLines(filePath, (record) => {
    if (record.type === 'session_meta') meta = record.payload || {};
    const message = messageFromRecord(record);
    if (!message) return;
    messageCount += 1;
    if (message.role === 'user' && !firstUser) firstUser = message.text;
    lastMessage = message.text;
    lastTimestamp = message.timestamp || lastTimestamp;
  });

  const id = meta.id || meta.session_id || path.basename(filePath, '.jsonl').split('-').slice(-5).join('-');
  const createdAt = meta.timestamp || stat.birthtime.toISOString();
  const updatedAt = lastTimestamp || stat.mtime.toISOString();
  return {
    id,
    title: shorten(firstUser, 90) || '제목 없는 세션',
    preview: shorten(lastMessage || firstUser, 180),
    cwd: meta.cwd || '',
    source: typeof meta.source === 'string' ? meta.source : (meta.originator || 'Codex CLI'),
    cliVersion: meta.cli_version || '',
    createdAt,
    updatedAt,
    messageCount,
    filePath
  };
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      try { results[index] = await mapper(items[index]); }
      catch { results[index] = null; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results.filter(Boolean);
}

async function listSessions(sessionsRoot) {
  const files = await listJsonlFiles(sessionsRoot);
  const activeFiles = new Set(files);
  for (const cachedPath of summaryCache.keys()) {
    if (!activeFiles.has(cachedPath)) summaryCache.delete(cachedPath);
  }
  const sessions = await mapWithConcurrency(files, 6, async (filePath) => {
    const stat = await fs.promises.stat(filePath);
    const cached = summaryCache.get(filePath);
    if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) return cached.session;
    const session = await summarizeSession(filePath);
    summaryCache.set(filePath, { mtimeMs: stat.mtimeMs, size: stat.size, session });
    return session;
  });
  return sessions.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

async function readSessionDetail(filePath) {
  const messages = [];
  let meta = {};
  let totalMessages = 0;
  await readLines(filePath, (record) => {
    if (record.type === 'session_meta') meta = record.payload || {};
    const message = messageFromRecord(record);
    if (!message) return;
    totalMessages += 1;
    messages.push({ ...message, text: message.text.slice(0, MAX_MESSAGE_LENGTH) });
    if (messages.length > MAX_DETAIL_MESSAGES) messages.shift();
  });
  return {
    meta: { id: meta.id || meta.session_id || '', cwd: meta.cwd || '', timestamp: meta.timestamp || '' },
    messages,
    totalMessages,
    truncated: totalMessages > messages.length
  };
}

module.exports = {
  cleanText,
  listJsonlFiles,
  listSessions,
  messageFromRecord,
  readSessionDetail,
  shorten,
  summarizeSession
};
