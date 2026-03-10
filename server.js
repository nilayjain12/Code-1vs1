const http = require('http');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const vm = require('vm');

const PORT = process.env.PORT || 3000;
const publicDir = path.join(__dirname, 'public');

const sessions = new Map();
const queue = [];
const rooms = new Map();
const streaks = new Map();

const questionBank = [
  {
    id: 'easy-sum',
    title: 'Add Two Numbers',
    difficulty: 'Easy',
    timeLimitSeconds: 120,
    prompt: 'Implement function solve(a, b) that returns the sum of two integers.',
    starterCode: `function solve(a, b) {\n  // your code here\n}`,
    tests: [
      { input: [1, 2], expected: 3 },
      { input: [12, 8], expected: 20 },
      { input: [-5, 4], expected: -1 }
    ]
  },
  {
    id: 'medium-pal',
    title: 'Palindrome Check',
    difficulty: 'Medium',
    timeLimitSeconds: 180,
    prompt: 'Implement function solve(str) that returns true if str is a palindrome (ignore case).',
    starterCode: `function solve(str) {\n  // your code here\n}`,
    tests: [
      { input: ['Level'], expected: true },
      { input: ['OpenAI'], expected: false },
      { input: ['Madam'], expected: true }
    ]
  }
];

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8'
};

const sendJson = (res, status, data) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
};

const parseBody = (req) =>
  new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });

const getStreak = (playerId) => streaks.get(playerId) || 0;
const winStreak = (playerId) => streaks.set(playerId, getStreak(playerId) + 1);
const loseStreak = (playerId) => streaks.set(playerId, 0);

function pickQuestion() {
  return questionBank[Math.floor(Math.random() * questionBank.length)];
}

function evaluateCode(code, question) {
  const wrapped = `${code}\nmodule.exports = solve;`;
  const context = vm.createContext({ module: { exports: {} }, exports: {} });
  const script = new vm.Script(wrapped);
  script.runInContext(context, { timeout: 800 });

  const fn = context.module.exports;
  if (typeof fn !== 'function') throw new Error('Please define function solve(...)');

  let passed = 0;
  for (const test of question.tests) {
    const result = fn(...test.input);
    if (Object.is(result, test.expected)) passed += 1;
  }

  return { passed, total: question.tests.length, allPassed: passed === question.tests.length };
}

function clearFromQueue(sessionId) {
  const idx = queue.indexOf(sessionId);
  if (idx !== -1) queue.splice(idx, 1);
}

function concludeRoom(room, winnerSessionId, reason) {
  if (room.ended) return;
  room.ended = true;
  clearTimeout(room.timeoutHandle);

  const loserSessionId = room.players.find((id) => id !== winnerSessionId);
  const winner = sessions.get(winnerSessionId);
  const loser = sessions.get(loserSessionId);
  if (!winner || !loser) return;

  winStreak(winner.playerId);
  loseStreak(loser.playerId);

  room.results.set(winnerSessionId, { result: 'win', reason });
  room.results.set(loserSessionId, { result: 'lose', reason });
}

function concludeDraw(room, reason) {
  if (room.ended) return;
  room.ended = true;
  clearTimeout(room.timeoutHandle);
  room.players.forEach((sessionId) => room.results.set(sessionId, { result: 'draw', reason }));
}

function concludeByTimeout(roomId) {
  const room = rooms.get(roomId);
  if (!room || room.ended) return;
  const [a, b] = room.players;
  const sa = room.submissions.get(a);
  const sb = room.submissions.get(b);

  if (!sa && !sb) return concludeDraw(room, 'timeout');
  if (sa && !sb) return concludeRoom(room, a, 'timeout');
  if (!sa && sb) return concludeRoom(room, b, 'timeout');
  if (sa.passed > sb.passed) return concludeRoom(room, a, 'timeout');
  if (sb.passed > sa.passed) return concludeRoom(room, b, 'timeout');
  if (sa.submittedAt <= sb.submittedAt) return concludeRoom(room, a, 'timeout-tiebreaker');
  return concludeRoom(room, b, 'timeout-tiebreaker');
}

function createRoom(a, b) {
  const question = pickQuestion();
  const id = randomUUID();
  const endsAt = Date.now() + question.timeLimitSeconds * 1000;
  const room = {
    id,
    question,
    players: [a, b],
    endsAt,
    submissions: new Map(),
    results: new Map(),
    ended: false,
    timeoutHandle: setTimeout(() => concludeByTimeout(id), question.timeLimitSeconds * 1000)
  };
  rooms.set(id, room);
  sessions.get(a).roomId = id;
  sessions.get(b).roomId = id;
}

function tryMatchmake() {
  while (queue.length >= 2) {
    const a = queue.shift();
    const b = queue.shift();
    if (!sessions.has(a) || !sessions.has(b)) continue;
    createRoom(a, b);
  }
}

async function handleApi(req, res, pathname, query) {
  if (pathname === '/api/register' && req.method === 'POST') {
    const { playerId, name } = await parseBody(req);
    if (!playerId) return sendJson(res, 400, { error: 'playerId is required' });
    const sessionId = randomUUID();
    sessions.set(sessionId, { sessionId, playerId, name: name?.trim() || 'Coder', roomId: null });
    return sendJson(res, 200, { sessionId, streak: getStreak(playerId) });
  }

  if (pathname === '/api/join-queue' && req.method === 'POST') {
    const { sessionId } = await parseBody(req);
    const session = sessions.get(sessionId);
    if (!session) return sendJson(res, 404, { error: 'session not found' });
    if (!session.roomId && !queue.includes(sessionId)) queue.push(sessionId);
    tryMatchmake();
    return sendJson(res, 200, { ok: true });
  }

  if (pathname === '/api/submit' && req.method === 'POST') {
    const { sessionId, code } = await parseBody(req);
    const session = sessions.get(sessionId);
    if (!session?.roomId) return sendJson(res, 400, { error: 'not in a room' });
    const room = rooms.get(session.roomId);
    if (!room || room.ended) return sendJson(res, 400, { error: 'room ended' });

    try {
      const result = evaluateCode(code || '', room.question);
      room.submissions.set(sessionId, { ...result, submittedAt: Date.now() });
      if (result.allPassed) concludeRoom(room, sessionId, 'all-tests-passed');
      return sendJson(res, 200, result);
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
  }

  if (pathname === '/api/state' && req.method === 'GET') {
    const session = sessions.get(query.sessionId);
    if (!session) return sendJson(res, 404, { error: 'session not found' });

    if (!session.roomId) {
      return sendJson(res, 200, { phase: queue.includes(session.sessionId) ? 'queue' : 'home', streak: getStreak(session.playerId) });
    }

    const room = rooms.get(session.roomId);
    if (!room) {
      session.roomId = null;
      return sendJson(res, 200, { phase: 'home', streak: getStreak(session.playerId) });
    }

    const result = room.results.get(session.sessionId);
    if (result) {
      session.roomId = null;
      setTimeout(() => rooms.delete(room.id), 10000);
      return sendJson(res, 200, { phase: 'result', ...result, streak: getStreak(session.playerId) });
    }

    return sendJson(res, 200, {
      phase: 'arena',
      streak: getStreak(session.playerId),
      endsAt: room.endsAt,
      question: {
        title: room.question.title,
        difficulty: room.question.difficulty,
        prompt: room.question.prompt,
        starterCode: room.question.starterCode,
        timeLimitSeconds: room.question.timeLimitSeconds
      }
    });
  }

  if (pathname === '/api/leave' && req.method === 'POST') {
    const { sessionId } = await parseBody(req);
    clearFromQueue(sessionId);
    const session = sessions.get(sessionId);
    if (session?.roomId) {
      const room = rooms.get(session.roomId);
      if (room && !room.ended) {
        const other = room.players.find((id) => id !== sessionId);
        if (other) concludeRoom(room, other, 'opponent-left');
      }
    }
    sessions.delete(sessionId);
    return sendJson(res, 200, { ok: true });
  }

  return false;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  try {
    const apiHandled = await handleApi(req, res, url.pathname, Object.fromEntries(url.searchParams));
    if (apiHandled !== false) return;
  } catch (error) {
    return sendJson(res, 500, { error: error.message || 'Internal server error' });
  }

  const filePath = url.pathname === '/' ? path.join(publicDir, 'index.html') : path.join(publicDir, url.pathname);
  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end('Not found');
    }

    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'text/plain; charset=utf-8' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Code 1vs1 running on http://localhost:${PORT}`);
});
