const homeView = document.getElementById('home');
const arenaView = document.getElementById('arena');
const nameInput = document.getElementById('nameInput');
const spinBtn = document.getElementById('spinBtn');
const queueStatus = document.getElementById('queueStatus');
const streakHome = document.getElementById('streakHome');
const mockList = document.getElementById('mockList');
const questionTitle = document.getElementById('questionTitle');
const difficulty = document.getElementById('difficulty');
const opponent = document.getElementById('opponent');
const questionPrompt = document.getElementById('questionPrompt');
const editor = document.getElementById('editor');
const timer = document.getElementById('timer');
const submitBtn = document.getElementById('submitBtn');
const homeBtn = document.getElementById('homeBtn');
const submissionStatus = document.getElementById('submissionStatus');

let playerId = localStorage.getItem('code1v1-player-id');
if (!playerId) {
  playerId = crypto.randomUUID();
  localStorage.setItem('code1v1-player-id', playerId);
}

let sessionId = null;
let countdownInterval = null;
let pollInterval = null;
let loadedRoomQuestion = null;
nameInput.value = localStorage.getItem('code1v1-name') || '';

const api = async (path, options = {}) => {
  const response = await fetch(path, {
    method: options.method || 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  return response.json();
};

const setMockList = (names = []) => {
  mockList.innerHTML = '';
  names.forEach((name) => {
    const li = document.createElement('li');
    li.textContent = name;
    mockList.appendChild(li);
  });
};

function switchTo(view) {
  homeView.classList.remove('active');
  arenaView.classList.remove('active');
  view.classList.add('active');
}

function startTimer(endsAt) {
  clearInterval(countdownInterval);
  const tick = () => {
    const sec = Math.max(0, Math.floor((endsAt - Date.now()) / 1000));
    const mm = String(Math.floor(sec / 60)).padStart(2, '0');
    const ss = String(sec % 60).padStart(2, '0');
    timer.textContent = `⏱ ${mm}:${ss}`;
  };
  tick();
  countdownInterval = setInterval(tick, 250);
}

async function registerSession() {
  const name = nameInput.value.trim() || 'Coder';
  localStorage.setItem('code1v1-name', name);
  const data = await api('/api/register', { method: 'POST', body: { playerId, name } });
  sessionId = data.sessionId;
  streakHome.textContent = `Current streak: ${data.streak || 0}`;
  setMockList(data.mockOpponents || []);
}

async function refreshState() {
  if (!sessionId) return;
  const state = await api(`/api/state?sessionId=${encodeURIComponent(sessionId)}`);

  if (state.phase === 'queue') {
    switchTo(homeView);
    queueStatus.textContent = 'Finding an online opponent... If no one joins, we auto-match you with a mock coder.';
    streakHome.textContent = `Current streak: ${state.streak}`;
    return;
  }

  if (state.phase === 'arena') {
    switchTo(arenaView);
    streakHome.textContent = `Current streak: ${state.streak}`;
    queueStatus.textContent = '';
    opponent.textContent = `vs ${state.opponentName}`;

    if (loadedRoomQuestion !== state.question.title) {
      loadedRoomQuestion = state.question.title;
      questionTitle.textContent = state.question.title;
      difficulty.textContent = state.question.difficulty;
      questionPrompt.textContent = state.question.prompt;
      editor.value = state.question.starterCode;
      submissionStatus.textContent = '';
    }

    startTimer(state.endsAt);
    return;
  }

  if (state.phase === 'result') {
    clearInterval(countdownInterval);
    loadedRoomQuestion = null;
    switchTo(arenaView);
    const text =
      state.result === 'win'
        ? `🏆 You won against ${state.opponentName} (${state.reason}). Streak: ${state.streak}`
        : state.result === 'lose'
          ? `💥 ${state.opponentName} won (${state.reason}). Streak reset to ${state.streak}.`
          : `🤝 Draw with ${state.opponentName} (${state.reason}). Streak: ${state.streak}`;
    submissionStatus.textContent = text;
    streakHome.textContent = `Current streak: ${state.streak}`;
    setTimeout(() => {
      switchTo(homeView);
      queueStatus.textContent = 'Queue up for another funky duel!';
    }, 2500);
    return;
  }

  if (state.phase === 'home') {
    switchTo(homeView);
    streakHome.textContent = `Current streak: ${state.streak}`;
  }
}

spinBtn.addEventListener('click', async () => {
  if (!sessionId) {
    await registerSession();
  }
  await api('/api/join-queue', { method: 'POST', body: { sessionId } });
  queueStatus.textContent = 'Finding an online opponent...';
});

submitBtn.addEventListener('click', async () => {
  if (!sessionId) return;
  submissionStatus.textContent = 'Running tests...';
  const result = await api('/api/submit', { method: 'POST', body: { sessionId, code: editor.value } });
  if (result.error) {
    submissionStatus.textContent = `Error: ${result.error}`;
    return;
  }

  submissionStatus.textContent = result.allPassed
    ? `All tests passed (${result.passed}/${result.total})! Waiting for match result...`
    : `Passed ${result.passed}/${result.total} test cases. Keep going.`;
});

homeBtn.addEventListener('click', () => {
  switchTo(homeView);
});

window.addEventListener('beforeunload', () => {
  if (sessionId) {
    navigator.sendBeacon('/api/leave', JSON.stringify({ sessionId }));
  }
});

(async () => {
  await registerSession();
  await refreshState();
  pollInterval = setInterval(refreshState, 1200);
})();
