const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

function existingFile(candidates) {
  return candidates.find((candidate) => candidate && fs.existsSync(candidate)) || null;
}

function findCodexExecutable() {
  if (process.env.CODEX_PATH && fs.existsSync(process.env.CODEX_PATH)) return process.env.CODEX_PATH;
  const home = os.homedir();
  const candidates = process.platform === 'win32'
    ? [
        process.env.APPDATA && path.join(process.env.APPDATA, 'npm', 'codex.cmd'),
        process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs', 'codex', 'codex.exe'),
        path.join(home, 'AppData', 'Roaming', 'npm', 'codex.cmd')
      ]
    : [
        path.join(home, '.local', 'bin', 'codex'),
        path.join(home, '.npm-global', 'bin', 'codex'),
        '/opt/homebrew/bin/codex',
        '/usr/local/bin/codex',
        '/usr/bin/codex'
      ];
  const direct = existingFile(candidates);
  if (direct) return direct;
  const lookup = spawnSync(process.platform === 'win32' ? 'where.exe' : 'which', ['codex'], { encoding: 'utf8', windowsHide: true });
  return lookup.status === 0 ? lookup.stdout.split(/\r?\n/).find(Boolean)?.trim() || null : null;
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'"'"'`)}'`;
}

function appleScriptQuote(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function validatedSessionId(sessionId) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId)) throw new Error('올바르지 않은 세션 ID입니다.');
  return sessionId;
}

function launchDetached(command, args, options = {}) {
  const child = spawn(command, args, { detached: true, stdio: 'ignore', windowsHide: false, ...options });
  child.unref();
}

function resumeSession({ sessionId, cwd }) {
  const safeId = validatedSessionId(sessionId);
  const codexPath = findCodexExecutable();
  if (!codexPath) throw new Error('Codex CLI를 찾지 못했습니다. Codex를 설치하거나 CODEX_PATH 환경 변수를 설정하세요.');
  const workingDirectory = cwd && fs.existsSync(cwd) ? cwd : os.homedir();

  if (process.platform === 'darwin') {
    const command = `cd ${shellQuote(workingDirectory)} && ${shellQuote(codexPath)} resume ${shellQuote(safeId)}`;
    const script = `tell application "Terminal"\nactivate\ndo script "${appleScriptQuote(command)}"\nend tell`;
    launchDetached('osascript', ['-e', script]);
  } else if (process.platform === 'win32') {
    const quotedCodex = `"${codexPath.replace(/"/g, '""')}"`;
    const command = `${quotedCodex} resume ${safeId}`;
    launchDetached('cmd.exe', ['/d', '/k', command], { cwd: workingDirectory });
  } else {
    const command = `cd ${shellQuote(workingDirectory)} && ${shellQuote(codexPath)} resume ${shellQuote(safeId)}`;
    const candidates = [
      ['x-terminal-emulator', ['-e', 'bash', '-lc', command]],
      ['gnome-terminal', ['--', 'bash', '-lc', command]],
      ['konsole', ['-e', 'bash', '-lc', command]]
    ];
    const terminal = candidates.find(([name]) => spawnSync('which', [name], { stdio: 'ignore' }).status === 0);
    if (!terminal) throw new Error('지원되는 터미널 앱을 찾지 못했습니다.');
    launchDetached(terminal[0], terminal[1]);
  }
  return { ok: true, codexPath, cwd: workingDirectory };
}

module.exports = { findCodexExecutable, resumeSession, shellQuote, validatedSessionId };
