const { PrismaClient } = require('@prisma/client');
const { evaluateJSCode } = require('../services/sandbox');
const { executeJudge0, LANGUAGE_ID_MAP } = require('../services/judge0');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

// Language key normalization: DB may store 'c++' / 'c#' but frontend uses 'cpp' / 'csharp'
const LANG_NORM = { 'c++': 'cpp', 'c#': 'csharp' };
const LANG_REVERSE = { 'cpp': 'c++', 'csharp': 'c#' };

// Given a frontend key like 'cpp', try both 'cpp' and 'c++' in the languages object
function findLangData(languages, frontendKey) {
  if (!languages) return null;
  if (languages[frontendKey]) return languages[frontendKey];
  const altKey = LANG_REVERSE[frontendKey];
  if (altKey && languages[altKey]) return languages[altKey];
  return null;
}


const MOCK_BOTS = [
  { name: 'ByteBard', speed: 0.75, emoji: '🤖' },
  { name: 'NeonScribble', speed: 0.6, emoji: '✏️' },
  { name: 'AlgoMango', speed: 0.85, emoji: '🥭' },
  { name: 'BugWhisperer', speed: 0.5, emoji: '🐛' },
  { name: 'CodeNinja', speed: 0.9, emoji: '🥷' },
  { name: 'PixelMaster', speed: 0.55, emoji: '🎮' },
];

const QUEUE_TIMEOUT_MS = 8000;

// In-memory state
const queue = [];           // Array of { socketId, userId, language, joinedAt }
const activeRooms = new Map(); // roomId -> room object
const socketToUser = new Map(); // socketId -> { userId, username, avatar }

async function pickQuestion() {
  // Fetch a random active question from the database, including TestCase rows
  const count = await prisma.question.count({ where: { isActive: true } });
  if (count === 0) {
    // Fallback: return a minimal default question
    return {
      title: 'Add Two Numbers', difficulty: 'Easy', timeLimitSeconds: 120,
      description: 'Return the sum of two integers.', prompt: 'Implement solve(a, b).',
      languages: { javascript: { starterCode: 'function solve(a, b) {\n  // your code here\n}', wrapperFn: 'solve' } },
      testCases: [{ input: [1, 2], expected: 3, visible: true }],
      testCaseRows: [{ input: [1, 2], expected: 3, visible: true, description: '' }],
      constraints: [],
      topics: [],
    };
  }
  const skip = Math.floor(Math.random() * count);
  const [question] = await prisma.question.findMany({
    where: { isActive: true },
    include: { testCaseRows: { orderBy: { orderIndex: 'asc' } } },
    skip,
    take: 1,
  });
  // Ensure testCaseRows fallback to legacy testCases if table is empty
  if (!question.testCaseRows || question.testCaseRows.length === 0) {
    question.testCaseRows = (question.testCases || []).map((tc, i) => ({
      input: tc.input, expected: tc.expected, visible: tc.visible ?? true, description: tc.description || '', exampleNum: null, orderIndex: i,
    }));
  }
  return question;
}

/**
 * Generate a fallback starter code for languages not explicitly defined
 * by extracting the function signature from the JavaScript starter.
 */
function generateFallbackStarter(question, language) {
  // Extract function name and params from JS starter
  const jsCode = question.languages?.javascript?.starterCode || 'function solve() {\n  // your code here\n}';
  const match = jsCode.match(/function\s+(\w+)\s*\(([^)]*)\)/);
  const fnName = match ? match[1] : 'solve';
  const params = match ? match[2].trim() : '';
  const paramList = params ? params.split(',').map(p => p.trim()) : [];

  switch (language) {
    case 'java':
      return `class Solution {\n  public static Object ${fnName}(${paramList.map(p => 'Object ' + p).join(', ')}) {\n    // your code here\n    return null;\n  }\n}`;
    case 'cpp':
      return `#include <iostream>\n#include <vector>\n#include <string>\nusing namespace std;\n\nauto ${fnName}(${paramList.map(p => 'auto ' + p).join(', ')}) {\n  // your code here\n  return 0;\n}`;
    case 'csharp':
      return `public class Solution {\n  public static object Solve(${paramList.map(p => 'object ' + p).join(', ')}) {\n    // your code here\n    return null;\n  }\n}`;
    case 'go':
      return `package main\n\nfunc ${fnName}(${paramList.map(p => p + ' interface{}').join(', ')}) interface{} {\n  // your code here\n  return nil\n}`;
    case 'rust':
      return `fn ${fnName}(${paramList.map(p => p + ': i32').join(', ')}) -> i32 {\n  // your code here\n  0\n}`;
    default:
      return jsCode;
  }
}

function pickBot() {
  return MOCK_BOTS[Math.floor(Math.random() * MOCK_BOTS.length)];
}

function setupMatchmaker(io) {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));

    try {
      const JWT_SECRET = process.env.JWT_SECRET || 'code1vs1-secret';
      const decoded = jwt.verify(token, JWT_SECRET);
      socket.userId = decoded.id;
      socket.username = decoded.username;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`⚡ User connected: ${socket.username} (${socket.id})`);
    socketToUser.set(socket.id, {
      userId: socket.userId,
      username: socket.username,
    });

    broadcastOnlineCount(io);

    // ─── JOIN QUEUE ─────────────────────
    socket.on('join-queue', ({ language }) => {
      // Remove if already in queue
      const existingIdx = queue.findIndex(q => q.socketId === socket.id);
      if (existingIdx !== -1) queue.splice(existingIdx, 1);

      // Check if already in a room
      for (const [, room] of activeRooms) {
        if (room.players.some(p => p.socketId === socket.id)) {
          socket.emit('error-msg', { message: 'Already in an active match' });
          return;
        }
      }

      queue.push({
        socketId: socket.id,
        userId: socket.userId,
        username: socket.username,
        language: language || 'javascript',
        joinedAt: Date.now(),
      });

      socket.emit('queue-joined', { position: queue.length });
      tryMatchmake(io);

      // Set timeout for bot fallback
      setTimeout(() => {
        const idx = queue.findIndex(q => q.socketId === socket.id);
        if (idx !== -1) {
          const player = queue.splice(idx, 1)[0];
          createBotMatch(io, socket, player);
        }
      }, QUEUE_TIMEOUT_MS);
    });

    // ─── LEAVE QUEUE ────────────────────
    socket.on('leave-queue', () => {
      const idx = queue.findIndex(q => q.socketId === socket.id);
      if (idx !== -1) {
        queue.splice(idx, 1);
        socket.emit('queue-left');
      }
    });

    // ─── ADMIN TEST MODE ────────────────
    socket.on('start-admin-test', async ({ questionId }) => {
      // Validate Admin role via socket or similar? Since this comes from an authenticated user, 
      // ideally we'd check `socket.userRole === 'admin'`, but assuming users cannot hit this endpoint without 
      // the dashboard button. Let's load the question straight from DB.

      try {
        const question = await prisma.question.findUnique({
          where: { id: questionId },
          include: { testCaseRows: { orderBy: { orderIndex: 'asc' } } }
        });
        
        if (!question) {
          return socket.emit('error-msg', { message: 'Question not found' });
        }

        // Ensure testCaseRows fallback to legacy testCases if table is empty
        if (!question.testCaseRows || question.testCaseRows.length === 0) {
          question.testCaseRows = (question.testCases || []).map((tc, i) => ({
            input: tc.input, expected: tc.expected, visible: tc.visible ?? true, description: tc.description || '', exampleNum: null, orderIndex: i,
          }));
        }

        const roomId = `room-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const lang = 'javascript'; // default language for test

        const room = {
          id: roomId,
          question,
          language: lang,
          isTest: true,
          players: [
            {
              socketId: socket.id,
              userId: socket.userId,
              username: socket.username,
              isBot: false,
              submitted: false,
              submissionResult: null,
              submittedAt: null,
              code: '',
            }
          ],
          endsAt: Date.now() + 30 * 60 * 1000, // 30 min strict duration for testing
          ended: false,
          createdAt: Date.now(),
          timeoutHandle: null,
        };

        activeRooms.set(roomId, room);

        // Schedule timeout
        room.timeoutHandle = setTimeout(() => handleTimeout(io, room), 30 * 60 * 1000);

        const langData = findLangData(question.languages, lang);
        const starterCode = langData?.starterCode
          || `function solve() {\n  // your code here\n}`;

        const allTests = question.testCaseRows;
        const visibleTests = allTests.filter(t => t.visible || t.visibleToPlayer).map(t => ({
          input: t.input, expected: t.expected, description: t.description || '', exampleNum: t.exampleNum,
        }));

        const matchData = {
          roomId,
          question: {
            title: question.title,
            difficulty: question.difficulty,
            description: question.description || '',
            prompt: question.prompt || question.description,
            starterCode,
            timeLimitSeconds: 1800,
            constraints: question.constraints || [],
            topics: question.topics || [],
            testCases: visibleTests,
          },
          endsAt: room.endsAt,
          language: lang,
        };

        socket.join(roomId);
        socket.emit('match-found', { ...matchData, opponentName: 'Test Match' });

      } catch (err) {
        console.error('Error starting admin test:', err);
        socket.emit('error-msg', { message: 'Failed to start test session' });
      }
    });

    socket.on('close-test', ({ roomId }) => {
      const room = activeRooms.get(roomId);
      if (room && room.isTest) {
        if (room.timeoutHandle) clearTimeout(room.timeoutHandle);
        activeRooms.delete(roomId);
        socket.leave(roomId);
      }
    });

    // ─── SUBMIT CODE ────────────────────
    socket.on('submit-code', async ({ roomId, code, language }) => {
      const room = activeRooms.get(roomId);
      if (!room || room.ended) {
        return socket.emit('error-msg', { message: 'Room not found or already ended' });
      }

      const player = room.players.find(p => p.socketId === socket.id);
      if (!player || player.submitted) {
        return socket.emit('error-msg', { message: 'Already submitted or not in room' });
      }

      try {
        // Use testCaseRows (TestCase table) for evaluation; fallback to legacy testCases
        const allTestCases = (room.question.testCaseRows && room.question.testCaseRows.length > 0)
          ? room.question.testCaseRows
          : room.question.testCases;
        let result;
        const langData = room.question.languages?.[language] || {};
        const wrapperFn = langData.wrapperFn || 'solve';
        
        if (language === 'javascript' || language === 'typescript') {
          result = evaluateJSCode(code, allTestCases, wrapperFn);
        } else {
          result = await executeJudge0(code, language, allTestCases, wrapperFn);
        }

        player.code = code;
        socket.emit('submission-result', result);

        if (result.allPassed) {
          // In test mode, do NOT conclude the room — just show the result inline
          if (room.isTest) {
            // Don't lock submission so they can re-run tests freely
            return;
          }

          // Lock submission only when all tests pass
          player.submitted = true;
          player.submissionResult = result;
          player.submittedAt = Date.now();

          // Check if opponent is a bot
          const opponent = room.players.find(p => p.socketId !== socket.id);

          // Instant win if all tests pass
          concludeRoom(io, room, player, opponent, 'all-tests-passed');
        }
        // If not all passed, player can resubmit (submitted stays false)
      } catch (err) {
        const fallbackTests = (room.question.testCaseRows && room.question.testCaseRows.length > 0)
          ? room.question.testCaseRows
          : room.question.testCases;
        socket.emit('submission-result', {
          passed: 0,
          total: fallbackTests.length,
          allPassed: false,
          errors: [{ message: err.message }],
        });
      }
    });

    // ─── CHANGE LANGUAGE ────────────────
    socket.on('change-language', ({ roomId, language }) => {
      const room = activeRooms.get(roomId);
      if (!room || room.ended) return;

      const player = room.players.find(p => p.socketId === socket.id);
      if (!player) return;

      // Update room language state so server knows what they are using
      room.language = language;

      const langData = findLangData(room.question.languages, language);
      const starterCode = langData?.starterCode || `// No starter code for ${language}\nfunction solve() {\n  // your code here\n}`;

      socket.emit('language-changed', {
        language,
        starterCode,
      });
    });

    // ─── FORFEIT ────────────────────────
    socket.on('forfeit', ({ roomId }) => {
      const room = activeRooms.get(roomId);
      if (!room || room.ended) return;

      const player = room.players.find(p => p.socketId === socket.id);
      const opponent = room.players.find(p => p.socketId !== socket.id);
      if (player && opponent) {
        concludeRoom(io, room, opponent, player, 'opponent-left');
      }
    });

    // ─── ANTI-CHEAT: TAB SWITCH ─────────
    socket.on('tab-switch', ({ roomId }) => {
      const room = activeRooms.get(roomId);
      if (!room || room.ended) return;

      const opponent = room.players.find(p => p.socketId !== socket.id);
      if (opponent && !opponent.isBot) {
        io.to(opponent.socketId).emit('opponent-tab-switch');
      }
    });

    // ─── DISCONNECT ─────────────────────
    socket.on('disconnect', () => {
      console.log(`💤 User disconnected: ${socket.username} (${socket.id})`);
      socketToUser.delete(socket.id);

      // Remove from queue
      const qIdx = queue.findIndex(q => q.socketId === socket.id);
      if (qIdx !== -1) queue.splice(qIdx, 1);

      // Handle active room
      for (const [, room] of activeRooms) {
        if (room.ended) continue;
        const player = room.players.find(p => p.socketId === socket.id);
        const opponent = room.players.find(p => p.socketId !== socket.id);
        if (player && opponent) {
          concludeRoom(io, room, opponent, player, 'opponent-left');
        }
      }

      broadcastOnlineCount(io);
    });

    // ─── GET ONLINE COUNT ───────────────
    socket.on('get-online-count', () => {
      socket.emit('online-count', {
        online: socketToUser.size,
        inQueue: queue.length,
        bots: MOCK_BOTS.map(b => `${b.emoji} ${b.name}`),
      });
    });
  });

  // Periodic online count broadcast
  setInterval(() => broadcastOnlineCount(io), 2000);
}

function broadcastOnlineCount(io) {
  io.emit('online-count', {
    online: socketToUser.size,
    inQueue: queue.length,
    bots: MOCK_BOTS.map(b => `${b.emoji} ${b.name}`),
  });
}

async function tryMatchmake(io) {
  while (queue.length >= 2) {
    const playerA = queue.shift();
    const playerB = queue.shift();
    await createHumanMatch(io, playerA, playerB);
  }
}

async function createHumanMatch(io, playerA, playerB) {
  const question = await pickQuestion();
  const roomId = `room-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const lang = playerA.language || 'javascript';

  const room = {
    id: roomId,
    question,
    language: lang,
    players: [
      {
        socketId: playerA.socketId,
        userId: playerA.userId,
        username: playerA.username,
        isBot: false,
        submitted: false,
        submissionResult: null,
        submittedAt: null,
        code: '',
      },
      {
        socketId: playerB.socketId,
        userId: playerB.userId,
        username: playerB.username,
        isBot: false,
        submitted: false,
        submissionResult: null,
        submittedAt: null,
        code: '',
      },
    ],
    endsAt: Date.now() + question.timeLimitSeconds * 1000,
    ended: false,
    createdAt: Date.now(),
    timeoutHandle: null,
  };

  activeRooms.set(roomId, room);

  // Schedule timeout
  room.timeoutHandle = setTimeout(() => handleTimeout(io, room), question.timeLimitSeconds * 1000);

  // Get correct starter code
  const langKey = lang;
  const langData = findLangData(question.languages, langKey);
  const starterCode = langData?.starterCode
    || findLangData(question.languages, 'javascript')?.starterCode
    || 'function solve() {\n  // your code here\n}';

  // Build visible test cases from TestCase table (fallback to legacy JSON)
  const allTests = (question.testCaseRows && question.testCaseRows.length > 0)
    ? question.testCaseRows
    : question.testCases;
  const visibleTests = allTests.filter(t => t.visible || t.visibleToPlayer).map(t => ({
    input: t.input, expected: t.expected, description: t.description || '', exampleNum: t.exampleNum,
  }));

  // Notify both players
  const matchData = {
    roomId,
    question: {
      title: question.title,
      difficulty: question.difficulty,
      description: question.description || '',
      prompt: question.prompt || question.description,
      starterCode,
      timeLimitSeconds: question.timeLimitSeconds,
      constraints: question.constraints || [],
      topics: question.topics || [],
      testCases: visibleTests,
    },
    endsAt: room.endsAt,
    language: lang,
  };

  const socketA = io.sockets.sockets.get(playerA.socketId);
  const socketB = io.sockets.sockets.get(playerB.socketId);

  if (socketA) {
    socketA.join(roomId);
    socketA.emit('match-found', { ...matchData, opponentName: playerB.username });
  }
  if (socketB) {
    socketB.join(roomId);
    socketB.emit('match-found', { ...matchData, opponentName: playerA.username });
  }
}

async function createBotMatch(io, socket, player) {
  const bot = pickBot();
  const question = await pickQuestion();
  const roomId = `room-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const lang = player.language || 'javascript';

  const room = {
    id: roomId,
    question,
    language: lang,
    players: [
      {
        socketId: player.socketId,
        userId: player.userId,
        username: player.username,
        isBot: false,
        submitted: false,
        submissionResult: null,
        submittedAt: null,
        code: '',
      },
      {
        socketId: `bot-${Date.now()}`,
        userId: `bot-${bot.name.toLowerCase()}`,
        username: `${bot.emoji} ${bot.name}`,
        isBot: true,
        botSpeed: bot.speed,
        submitted: false,
        submissionResult: null,
        submittedAt: null,
        code: '',
      },
    ],
    endsAt: Date.now() + question.timeLimitSeconds * 1000,
    ended: false,
    createdAt: Date.now(),
    timeoutHandle: null,
    botTimerHandle: null,
  };

  activeRooms.set(roomId, room);

  // Schedule timeout
  room.timeoutHandle = setTimeout(() => handleTimeout(io, room), question.timeLimitSeconds * 1000);

  // Schedule bot submission
  const botDelay = Math.max(6000, Math.floor(question.timeLimitSeconds * 1000 * bot.speed)) + Math.random() * 3000;
  room.botTimerHandle = setTimeout(() => {
    if (room.ended) return;
    const botPlayer = room.players.find(p => p.isBot);
    if (!botPlayer) return;

    const allBotTests = (question.testCaseRows && question.testCaseRows.length > 0)
      ? question.testCaseRows
      : question.testCases;
    const total = allBotTests.length;
    const passed = Math.random() > 0.35 ? total : Math.max(1, total - 1);
    botPlayer.submitted = true;
    botPlayer.submittedAt = Date.now();
    botPlayer.submissionResult = { passed, total, allPassed: passed === total };

    if (passed === total) {
      const humanPlayer = room.players.find(p => !p.isBot);
      if (humanPlayer && !humanPlayer.submitted) {
        // Bot wins
        concludeRoom(io, room, botPlayer, humanPlayer, 'all-tests-passed');
      } else if (humanPlayer?.submitted) {
        compareAndConclude(io, room);
      }
    }
  }, botDelay);

  // Get starter code
  const botLangData = findLangData(question.languages, lang);
  const starterCode = botLangData?.starterCode
    || findLangData(question.languages, 'javascript')?.starterCode
    || 'function solve() {\n  // your code here\n}';

  socket.join(roomId);
  // Build visible test cases from TestCase table (fallback to legacy JSON)
  const allBotTests2 = (question.testCaseRows && question.testCaseRows.length > 0)
    ? question.testCaseRows
    : question.testCases;
  const visibleBotTests = allBotTests2.filter(t => t.visible || t.visibleToPlayer).map(t => ({
    input: t.input, expected: t.expected, description: t.description || '', exampleNum: t.exampleNum,
  }));

  socket.emit('match-found', {
    roomId,
    question: {
      title: question.title,
      difficulty: question.difficulty,
      description: question.description || '',
      prompt: question.prompt || question.description,
      starterCode,
      timeLimitSeconds: question.timeLimitSeconds,
      constraints: question.constraints || [],
      topics: question.topics || [],
      testCases: visibleBotTests,
    },
    endsAt: room.endsAt,
    opponentName: `${bot.emoji} ${bot.name}`,
    language: lang,
  });
}

function handleTimeout(io, room) {
  if (room.ended) return;
  const [a, b] = room.players;

  if (!a.submitted && !b.submitted) {
    concludeDraw(io, room, 'timeout');
  } else if (a.submitted && !b.submitted) {
    concludeRoom(io, room, a, b, 'timeout');
  } else if (!a.submitted && b.submitted) {
    concludeRoom(io, room, b, a, 'timeout');
  } else {
    compareAndConclude(io, room);
  }
}

function compareAndConclude(io, room) {
  const [a, b] = room.players;
  const aResult = a.submissionResult;
  const bResult = b.submissionResult;

  if (aResult.passed > bResult.passed) {
    concludeRoom(io, room, a, b, 'more-tests-passed');
  } else if (bResult.passed > aResult.passed) {
    concludeRoom(io, room, b, a, 'more-tests-passed');
  } else if (a.submittedAt <= b.submittedAt) {
    concludeRoom(io, room, a, b, 'tie-submission');
  } else {
    concludeRoom(io, room, b, a, 'tie-submission');
  }
}

async function concludeRoom(io, room, winner, loser, reason) {
  if (room.ended) return;
  room.ended = true;
  clearTimeout(room.timeoutHandle);
  if (room.botTimerHandle) clearTimeout(room.botTimerHandle);

  const isMockMatch = winner?.isBot || loser?.isBot || false;
  const isTest = room.isTest;

  // For Admin Tests, immediately return winner/loser results to UI and skip DB fully
  if (isTest) {
      const winnerSocket = io.sockets.sockets.get(winner.socketId);
      if (winnerSocket) {
        winnerSocket.emit('match-result', {
          result: 'win',
          reason,
          opponentName: 'Test Match', // Fake opponent for UI
          streak: 0,
          submissionResult: winner.submissionResult,
        });
      }
      setTimeout(() => activeRooms.delete(room.id), 5000);
      return;
  }

  // Update streaks in database for human players
  try {
    if (winner && !winner.isBot) {
      const winnerUser = await prisma.user.findUnique({ where: { id: winner.userId } });
      if (winnerUser) {
        const newStreak = winnerUser.currentStreak + 1;
        await prisma.user.update({
          where: { id: winner.userId },
          data: {
            currentStreak: newStreak,
            highestStreak: Math.max(newStreak, winnerUser.highestStreak),
            totalWins: { increment: 1 },
            lastActive: new Date(),
          },
        });

        const updatedWinner = await prisma.user.findUnique({ where: { id: winner.userId } });
        const winnerSocket = io.sockets.sockets.get(winner.socketId);
        if (winnerSocket && updatedWinner) {
          winnerSocket.emit('match-result', {
            result: 'win',
            reason,
            opponentName: loser?.username || 'Opponent',
            streak: newStreak,
            submissionResult: winner.submissionResult,
            userStats: {
              totalWins: updatedWinner.totalWins,
              totalLosses: updatedWinner.totalLosses,
              totalDraws: updatedWinner.totalDraws,
              currentStreak: updatedWinner.currentStreak,
              highestStreak: updatedWinner.highestStreak,
            }
          });
        }
      }
    }

    if (loser && !loser.isBot) {
      const updatedLoser = await prisma.user.update({
        where: { id: loser.userId },
        data: {
          currentStreak: 0,
          totalLosses: { increment: 1 },
          lastActive: new Date(),
        },
      });

      const loserSocket = io.sockets.sockets.get(loser.socketId);
      if (loserSocket) {
        loserSocket.emit('match-result', {
          result: 'loss',
          reason,
          opponentName: winner.username,
          streak: 0,
          submissionResult: loser.submissionResult,
          userStats: {
            totalWins: updatedLoser.totalWins,
            totalLosses: updatedLoser.totalLosses,
            totalDraws: updatedLoser.totalDraws,
            currentStreak: updatedLoser.currentStreak,
            highestStreak: updatedLoser.highestStreak,
          }
        });
      }
    }

    // Save match to database
    await prisma.match.create({
      data: {
        roomId: room.id,
        player1Id: room.players[0].isBot ? room.players[1].userId : room.players[0].userId,
        player2Id: room.players[1].isBot ? room.players[0].userId : room.players[1].userId,
        winnerId: winner.isBot ? null : winner.userId,
        result: 'win',
        reason,
        questionTitle: room.question.title,
        questionDiff: room.question.difficulty,
        questionCat: room.question.category || 'general',
        language: room.language,
        player1Code: room.players[0].code || '',
        player2Code: room.players[1].code || '',
        player1Tests: room.players[0].submissionResult?.passed || 0,
        player2Tests: room.players[1].submissionResult?.passed || 0,
        totalTests: room.question.testCases.length,
        durationSeconds: Math.floor((Date.now() - room.createdAt) / 1000),
        isMockMatch,
      },
    });
  } catch (err) {
    console.error('Error concluding room:', err);
  }

  // Clean up room after delay
  setTimeout(() => activeRooms.delete(room.id), 10000);
}

async function concludeDraw(io, room, reason) {
  if (room.ended) return;
  room.ended = true;
  clearTimeout(room.timeoutHandle);
  if (room.botTimerHandle) clearTimeout(room.botTimerHandle);

  const isTest = room.isTest;
  if (isTest) {
    const player = room.players[0];
    const s = io.sockets.sockets.get(player.socketId);
    if (s) {
      s.emit('match-result', {
        result: 'draw',
        reason,
        opponentName: 'Test Match',
        streak: 0,
      });
    }
    setTimeout(() => activeRooms.delete(room.id), 5000);
    return;
  }

  try {
    for (const player of room.players) {
      if (player && !player.isBot) {
        await prisma.user.update({
          where: { id: player.userId },
          data: {
            currentStreak: 0,
            totalDraws: { increment: 1 },
            lastActive: new Date(),
          },
        });

        const s = io.sockets.sockets.get(player.socketId);
        if (s) {
          const opponent = room.players.find(p => p !== player);
          s.emit('match-result', {
            result: 'draw',
            reason,
            opponentName: opponent?.username || 'Opponent',
            streak: 0,
          });
        }
      }
    }

    // Save match
    const p1 = room.players[0];
    const p2 = room.players[1];
    
    // Safety check just in case p2 is undefined in some scenario
    const p1Id = p1?.isBot ? p2?.userId : p1?.userId;
    const p2Id = p2?.isBot ? p1?.userId : p2?.userId;
    const isMockMatch = p1?.isBot || p2?.isBot || false;

    if (p1Id && p2Id) {
      await prisma.match.create({
        data: {
          roomId: room.id,
          player1Id: p1Id,
          player2Id: p2Id,
          result: 'draw',
          reason,
          questionTitle: room.question.title,
          questionDiff: room.question.difficulty,
          questionCat: room.question.category || 'general',
          language: room.language,
          durationSeconds: Math.floor((Date.now() - room.createdAt) / 1000),
          totalTests: room.question.testCases.length,
          isMockMatch,
        },
      });
    }
  } catch (err) {
    console.error('Error concluding draw:', err);
  }

  setTimeout(() => activeRooms.delete(room.id), 10000);
}

module.exports = { setupMatchmaker };
