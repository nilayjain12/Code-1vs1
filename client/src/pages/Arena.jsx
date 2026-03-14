import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { useAuthStore } from '../store/authStore';
import { useGameStore } from '../store/gameStore';
import { getSocket, connectSocket } from '../lib/socket';
import { reportTabSwitch, reportCopyAttempt } from '../lib/api';

const LANG_TO_MONACO = {
  javascript: 'javascript',
  typescript: 'typescript',
  python: 'python',
  java: 'java',
  cpp: 'cpp',
  csharp: 'csharp',
  go: 'go',
  rust: 'rust',
};

const LANGUAGES = [
  { value: 'javascript', label: '🟨 JavaScript' },
  { value: 'python', label: '🐍 Python' },
  { value: 'typescript', label: '🔷 TypeScript' },
  { value: 'java', label: '☕ Java' },
  { value: 'cpp', label: '⚙️ C++' },
  { value: 'csharp', label: '🟣 C#' },
  { value: 'go', label: '🐹 Go' },
  { value: 'rust', label: '🦀 Rust' },
];

export default function Arena() {
  const navigate = useNavigate();
  const { user, token, updateUser } = useAuthStore();
  const { currentMatch, setSubmissionResult, submissionResult, setMatchResult, matchResult, clearMatch, updateMatchLanguage } = useGameStore();
  const [code, setCode] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [tabWarning, setTabWarning] = useState(false);
  const [tabCountdown, setTabCountdown] = useState(5);
  const tabTimerRef = useRef(null);
  const editorRef = useRef(null);

  // Initialize code from starter ONLY on first match load
  useEffect(() => {
    if (currentMatch?.question?.starterCode && !code) {
      setCode(currentMatch.question.starterCode);
    }
  }, [currentMatch?.roomId]);

  // Redirect if no match
  useEffect(() => {
    if (!currentMatch) {
      navigate('/dashboard');
    }
  }, [currentMatch, navigate]);

  // Socket listeners
  useEffect(() => {
    const socket = getSocket() || connectSocket(token);

    socket.on('submission-result', (result) => {
      setSubmissionResult(result);
      setSubmitting(false);
    });

    socket.on('match-result', (result) => {
      setMatchResult(result);
      // Update the user's latest stats in store
      if (result.userStats) {
        updateUser(result.userStats);
      } else if (result.streak !== undefined) {
        updateUser({ currentStreak: result.streak });
      }
    });

    socket.on('opponent-tab-switch', () => {
      // Could show this to the player as info
    });

    socket.on('language-changed', ({ language, starterCode }) => {
      updateMatchLanguage(language);
      setCode(starterCode);
    });

    return () => {
      socket.off('submission-result');
      socket.off('match-result');
      socket.off('opponent-tab-switch');
      socket.off('language-changed');
    };
  }, [token, setSubmissionResult, setMatchResult, updateUser, updateMatchLanguage]);

  // Timer countdown
  useEffect(() => {
    if (!currentMatch?.endsAt) return;

    const update = () => {
      const remaining = Math.max(0, Math.floor((currentMatch.endsAt - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) return;
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [currentMatch?.endsAt]);

  // ─── ANTI-CHEAT: Tab visibility ────────────
  useEffect(() => {
    if (!currentMatch) return;

    const handleVisibility = () => {
      if (document.hidden) {
        setTabWarning(true);
        setTabCountdown(5);

        // Report to server
        const socket = getSocket();
        if (socket) socket.emit('tab-switch', { roomId: currentMatch.roomId });
        reportTabSwitch(currentMatch.roomId).catch(() => {});

        // Start forfeit countdown
        let count = 5;
        tabTimerRef.current = setInterval(() => {
          count--;
          setTabCountdown(count);
          if (count <= 0) {
            clearInterval(tabTimerRef.current);
            // Auto-forfeit
            const s = getSocket();
            if (s) s.emit('forfeit', { roomId: currentMatch.roomId });
          }
        }, 1000);
      } else {
        // Returned - clear timer
        setTabWarning(false);
        if (tabTimerRef.current) {
          clearInterval(tabTimerRef.current);
          tabTimerRef.current = null;
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      if (tabTimerRef.current) clearInterval(tabTimerRef.current);
    };
  }, [currentMatch]);

  // ─── ANTI-CHEAT: Copy-paste prevention ─────
  useEffect(() => {
    if (!currentMatch) return;

    const preventCopy = (e) => {
      e.preventDefault();
      reportCopyAttempt(currentMatch.roomId).catch(() => {});
    };

    const preventKeyboard = (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'v' || e.key === 'x')) {
        // Allow within editor (typing is OK, we block clipboard)
        if (e.target.closest('.monaco-editor')) {
          e.preventDefault();
          reportCopyAttempt(currentMatch.roomId).catch(() => {});
        }
      }
    };

    const preventContextMenu = (e) => {
      if (e.target.closest('.arena__editor-wrapper')) {
        e.preventDefault();
      }
    };

    document.addEventListener('copy', preventCopy);
    document.addEventListener('paste', preventCopy);
    document.addEventListener('keydown', preventKeyboard);
    document.addEventListener('contextmenu', preventContextMenu);

    return () => {
      document.removeEventListener('copy', preventCopy);
      document.removeEventListener('paste', preventCopy);
      document.removeEventListener('keydown', preventKeyboard);
      document.removeEventListener('contextmenu', preventContextMenu);
    };
  }, [currentMatch]);

  // Submit code
  const handleSubmit = () => {
    if (submitting || !currentMatch) return;
    setSubmitting(true);
    const socket = getSocket();
    if (socket) {
      socket.emit('submit-code', {
        roomId: currentMatch.roomId,
        code,
        language: currentMatch.language || 'javascript',
      });
    }
  };

  // Forfeit
  const handleForfeit = () => {
    if (!currentMatch) return;
    const socket = getSocket();
    if (socket) {
      socket.emit('forfeit', { roomId: currentMatch.roomId });
    }
  };

  // Go home after result
  const handleGoHome = () => {
    clearMatch();
    navigate('/dashboard');
  };

  // Format timer
  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Determine timer class
  const timerClass = timeLeft <= 10 ? 'timer timer--danger' : timeLeft <= 30 ? 'timer timer--warning' : 'timer';

  if (!currentMatch) return null;

  const { question, opponentName, language } = currentMatch;
  const diffBadge = question.difficulty === 'Easy' ? 'easy' : question.difficulty === 'Medium' ? 'medium' : 'hard';

  return (
    <div className="arena">
      {/* Anti-Cheat Warning Overlay */}
      {tabWarning && (
        <div className="anticheat-warning">
          <h2>⚠️ Don't Leave The Arena!</h2>
          <p>You'll forfeit if you don't return!</p>
          <div className="countdown">{tabCountdown}</div>
        </div>
      )}

      {/* Match Result Overlay */}
      {matchResult && (
        <div className="result-overlay">
          <div className="result-emoji">
            {matchResult.result === 'win' ? '🏆' : matchResult.result === 'loss' ? '💥' : '🤝'}
          </div>
          <div className={`result-title result-title--${matchResult.result}`}>
            {matchResult.result === 'win' ? 'You Won!' : matchResult.result === 'loss' ? 'You Lost' : 'Draw!'}
          </div>
          <div className="result-details">
            <p>vs {matchResult.opponentName}</p>
            <p>Reason: {matchResult.reason}</p>
          </div>
          <div className="result-streak">
            {matchResult.result === 'win'
              ? `🔥 Streak: ${matchResult.streak}`
              : '💫 Streak reset to 0'}
          </div>
          <button
            className="retro-btn retro-btn--primary retro-btn--large"
            onClick={handleGoHome}
            style={{ marginTop: '1.5rem' }}
          >
            🏠 Back to Dashboard
          </button>
        </div>
      )}

      {/* Top Bar */}
      <div className="arena__top-bar">
        <div className="arena__vs">
          <span className="arena__vs-name">{user?.username}</span>
          <span>⚔️</span>
          <span className="arena__vs-name">{opponentName}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span className={`badge badge--${diffBadge}`}>{question.difficulty}</span>
          <span className="badge badge--lang">{language}</span>
          <div className={timerClass}>{formatTime(timeLeft)}</div>
        </div>
      </div>

      {/* Panels */}
      <div className="arena__panels">
        {/* Problem Panel */}
        <div className="arena__problem">
          <h2 style={{ marginBottom: '0.5rem', fontSize: '1.5rem' }}>{question.title}</h2>
          <span className={`badge badge--${diffBadge}`} style={{ marginBottom: '1rem', display: 'inline-flex' }}>
            {question.difficulty}
          </span>
          <p style={{
            fontFamily: 'var(--font-body)',
            fontSize: '1rem',
            lineHeight: '1.7',
            marginTop: '1rem',
            marginBottom: '1.5rem',
          }}>
            {question.prompt}
          </p>

          {/* Example Test Cases */}
          {question.testCases && question.testCases.length > 0 && (
            <div>
              <h4 style={{ marginBottom: '0.75rem' }}>📝 Examples</h4>
              {question.testCases.map((tc, i) => (
                <div key={i} style={{
                  background: 'var(--cream-dark)',
                  border: '2px solid var(--ink)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.75rem',
                  marginBottom: '0.5rem',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.9rem',
                  overflowWrap: 'break-word',
                  wordBreak: 'break-all',
                  overflow: 'hidden',
                }}>
                  <div><strong>Input:</strong> {JSON.stringify(tc.input)}</div>
                  <div><strong>Expected:</strong> {JSON.stringify(tc.expected)}</div>
                </div>
              ))}
            </div>
          )}

          <p style={{
            fontFamily: 'var(--font-heading)',
            color: 'var(--neon-pink)',
            marginTop: '1rem',
            fontSize: '0.95rem',
          }}>
            ⚠️ Copy-paste is disabled. No tab switching allowed!
          </p>
        </div>

        {/* Editor Panel */}
        <div className="arena__editor-panel">
          <div className="arena__editor-header">
            <span style={{ color: '#ccc', fontFamily: 'var(--font-heading)', fontSize: '1rem' }}>
              📝 Your Code
            </span>
            <span style={{ color: '#888', fontSize: '0.85rem' }}>
              Language: 
              <select
                value={language}
                onChange={(e) => {
                  if (confirm('Changing language will reset your code. Continue?')) {
                    const socket = getSocket();
                    if (socket) {
                      socket.emit('change-language', {
                        roomId: currentMatch.roomId,
                        language: e.target.value
                      });
                    }
                  }
                }}
                style={{
                  background: 'transparent',
                  color: 'inherit',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  marginLeft: '0.5rem',
                  padding: '2px 4px',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                {LANGUAGES.map(lang => (
                  <option key={lang.value} value={lang.value} style={{ background: '#222' }}>{lang.label}</option>
                ))}
              </select>
            </span>
          </div>

          <div className="arena__editor-wrapper">
            <Editor
              height="100%"
              language={LANG_TO_MONACO[language] || 'javascript'}
              theme="vs-dark"
              value={code}
              onChange={(val) => setCode(val || '')}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 2,
                wordWrap: 'on',
                padding: { top: 10 },
                contextmenu: false,
              }}
              onMount={(editor) => { editorRef.current = editor; }}
            />
          </div>

          {/* Feedback Area */}
          {submissionResult && (
            <div className="arena__feedback">
              <div className={submissionResult.allPassed ? 'arena__feedback--pass' : 'arena__feedback--fail'}>
                {submissionResult.allPassed
                  ? `✅ All ${submissionResult.total} tests passed!`
                  : `❌ Passed ${submissionResult.passed}/${submissionResult.total} tests`
                }
              </div>
              {submissionResult.errors?.map((err, i) => (
                <div key={i} style={{ color: '#ff6b6b', marginTop: '0.25rem', fontSize: '0.85rem' }}>
                  {err.message}
                </div>
              ))}
            </div>
          )}

          {/* Action Bar */}
          <div className="arena__actions">
            <button
              className="retro-btn retro-btn--danger"
              onClick={handleForfeit}
              style={{ fontSize: '0.9rem', padding: '0.5rem 1rem' }}
            >
              🏳️ Forfeit
            </button>

            <button
              className="retro-btn retro-btn--primary retro-btn--glow"
              onClick={handleSubmit}
              disabled={submitting || !!matchResult}
            >
              {submitting ? '⏳ Running Tests...' : submissionResult?.allPassed ? '🚀 Submit Code' : '🚀 Run Tests'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
