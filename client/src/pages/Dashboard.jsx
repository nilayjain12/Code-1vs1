import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useGameStore } from '../store/gameStore';
import { connectSocket, getSocket, disconnectSocket } from '../lib/socket';
import { getUserMatchHistory, getUserStats } from '../lib/api';

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

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, token, updateUser } = useAuthStore();
  const {
    inQueue, setInQueue, selectedLanguage, setLanguage,
    onlineCount, availableBots, updateOnlineCount,
    setMatch, setMatchResult, currentMatch,
  } = useGameStore();
  const [recentMatches, setRecentMatches] = useState([]);
  const [freshStats, setFreshStats] = useState(null);

  const setupSocket = useCallback(() => {
    const socket = connectSocket(token);

    socket.on('online-count', (data) => updateOnlineCount(data));
    socket.on('queue-joined', () => setInQueue(true));
    socket.on('queue-left', () => setInQueue(false));

    socket.on('match-found', (data) => {
      setMatch(data);
      navigate('/arena');
    });

    socket.on('error-msg', (data) => {
      console.error('Socket error:', data.message);
      setInQueue(false);
    });

    socket.emit('get-online-count');

    return socket;
  }, [token, navigate, updateOnlineCount, setInQueue, setMatch]);

  useEffect(() => {
    const socket = setupSocket();
    return () => {
      socket.off('online-count');
      socket.off('queue-joined');
      socket.off('queue-left');
      socket.off('match-found');
      socket.off('error-msg');
    };
  }, [setupSocket]);

  // Fetch fresh stats from DB on mount
  useEffect(() => {
    if (user?.id) {
      getUserStats(user.id)
        .then(data => setFreshStats(data.stats))
        .catch(() => {});
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
      getUserMatchHistory(user.id, 1).then(data => {
        setRecentMatches(data.matches?.slice(0, 3) || []);
      }).catch(() => {});
    }
  }, [user?.id]);

  const handleJoinQueue = () => {
    const socket = getSocket();
    if (socket) {
      socket.emit('join-queue', { language: selectedLanguage });
    }
  };

  const handleLeaveQueue = () => {
    const socket = getSocket();
    if (socket) {
      socket.emit('leave-queue');
      setInQueue(false);
    }
  };

  return (
    <div style={{ position: 'relative', minHeight: 'calc(100vh - 60px)' }}>
      {/* Queue Overlay */}
      {inQueue && (
        <div className="queue-overlay">
          <div className="queue-spinner" />
          <div className="queue-text">🔍 Searching for Opponent...</div>
          <div className="queue-subtext">
            Matching you with a worthy rival (or a bot if none found)
          </div>
          <button
            className="retro-btn retro-btn--danger queue-cancel-btn"
            onClick={handleLeaveQueue}
          >
            ❌ Cancel
          </button>
        </div>
      )}

      <div className="page-container">
        {/* Floating emojis */}
        <span className="floating-emoji" style={{ top: '5%', right: '5%' }}>⚡</span>
        <span className="floating-emoji" style={{ top: '30%', left: '2%', animationDelay: '1.5s' }}>🎮</span>

        {/* Welcome Header */}
        <div className="page-header">
          <h1>Welcome, {user?.username}! 🎮</h1>
          <p>Ready to prove your coding skills?</p>
        </div>

        {/* Streak + Start Button */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1.5rem',
          marginBottom: '3rem',
        }}>
          {/* Current Streak */}
          <div className="retro-card retro-card--orange" style={{
            textAlign: 'center',
            padding: '2rem 3rem',
          }}>
            <div className="streak-display">
              <div>
                <div className="streak-display__number" style={{ color: 'white', textShadow: '3px 3px 0 rgba(0,0,0,0.3)' }}>
                  {user?.currentStreak || 0}
                </div>
                <div className="streak-display__label" style={{ color: 'rgba(255,255,255,0.9)' }}>
                  🔥 Current Streak
                </div>
              </div>
            </div>
            {user?.highestStreak > 0 && (
              <p style={{ fontFamily: 'var(--font-heading)', marginTop: '0.5rem', color: 'rgba(255,255,255,0.8)' }}>
                Best ever: {user.highestStreak} 🏆
              </p>
            )}
          </div>

          {/* Language Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <label style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem' }}>
              Choose your weapon:
            </label>
            <select
              className="retro-select"
              value={selectedLanguage}
              onChange={(e) => setLanguage(e.target.value)}
              style={{ width: '220px' }}
            >
              {LANGUAGES.map(lang => (
                <option key={lang.value} value={lang.value}>{lang.label}</option>
              ))}
            </select>
          </div>

          {/* Start Battle Button */}
          <button
            className="retro-btn retro-btn--primary retro-btn--large retro-btn--glow"
            onClick={handleJoinQueue}
            disabled={inQueue}
          >
            🎯 Spin Up an Opponent!
          </button>

          {/* Online Status */}
          <div style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '1.15rem',
            color: 'var(--ink-light)',
            textAlign: 'center',
          }}>
            <span style={{ color: 'var(--neon-green)', fontWeight: 700 }}>⚡ {onlineCount}</span> coders online right now
          </div>
        </div>

        {/* Bottom Section */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '1.5rem',
        }}>
          {/* Quick Stats */}
          <div className="retro-card">
            <h3 style={{ marginBottom: '1rem' }}>📊 Your Stats</h3>
            <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
              <div className="stats-grid__item">
                <div className="stats-grid__value">{freshStats?.totalWins ?? user?.totalWins ?? 0}</div>
                <div className="stats-grid__label">Wins</div>
              </div>
              <div className="stats-grid__item">
                <div className="stats-grid__value">{freshStats?.totalLosses ?? user?.totalLosses ?? 0}</div>
                <div className="stats-grid__label">Losses</div>
              </div>
              <div className="stats-grid__item">
                <div className="stats-grid__value">
                  {freshStats
                    ? freshStats.winRate
                    : (user?.totalWins + user?.totalLosses + user?.totalDraws > 0
                        ? Math.round((user.totalWins / (user.totalWins + user.totalLosses + user.totalDraws)) * 100)
                        : 0)}%
                </div>
                <div className="stats-grid__label">Win Rate</div>
              </div>
              <div className="stats-grid__item">
                <div className="stats-grid__value">{freshStats?.highestStreak ?? user?.highestStreak ?? 0}</div>
                <div className="stats-grid__label">Best Streak</div>
              </div>
            </div>
          </div>

          {/* Available Bots */}
          <div className="retro-card">
            <h3 style={{ marginBottom: '1rem' }}>🤖 Bot Opponents</h3>
            <p style={{ fontFamily: 'var(--font-heading)', marginBottom: '0.75rem', color: 'var(--ink-light)' }}>
              If no human is found, you'll face one of these:
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {(availableBots.length > 0 ? availableBots : ['🤖 ByteBard', '✏️ NeonScribble', '🥭 AlgoMango', '🐛 BugWhisperer', '🥷 CodeNinja', '🎮 PixelMaster']).map((bot, i) => (
                <span key={i} className="badge badge--lang">{bot}</span>
              ))}
            </div>
          </div>

          {/* Recent Matches */}
          <div className="retro-card">
            <h3 style={{ marginBottom: '1rem' }}>⏱️ Recent Matches</h3>
            {recentMatches.length === 0 ? (
              <p style={{ fontFamily: 'var(--font-heading)', color: 'var(--ink-muted)' }}>
                No matches yet. Start your first battle! 🎮
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {recentMatches.map((match) => (
                  <div key={match.id} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.5rem',
                    background: 'var(--cream)',
                    borderRadius: 'var(--radius-sm)',
                    border: '2px solid var(--ink)',
                  }}>
                    <span style={{ fontFamily: 'var(--font-heading)' }}>
                      vs {match.opponent?.username || 'Unknown'}
                    </span>
                    <span className={`badge badge--${match.result === 'win' ? 'easy' : match.result === 'loss' ? 'hard' : 'medium'}`}>
                      {match.result === 'win' ? '🏆 Win' : match.result === 'loss' ? '💥 Loss' : '🤝 Draw'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
