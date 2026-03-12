import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { getUserStats, getUserMatchHistory, updateUserProfile } from '../lib/api';

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

export default function Profile() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user: currentUser, updateUser: updateAuthUser } = useAuthStore();
  const [stats, setStats] = useState(null);
  const [matches, setMatches] = useState([]);
  const [matchPage, setMatchPage] = useState(1);
  const [totalMatchPages, setTotalMatchPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ username: '', avatar: '', bio: '', favoriteLanguage: '' });
  const [editError, setEditError] = useState('');

  const isOwnProfile = currentUser?.id === userId;

  useEffect(() => {
    fetchProfile();
  }, [userId]);

  useEffect(() => {
    fetchMatches();
  }, [userId, matchPage]);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const data = await getUserStats(userId);
      setStats(data.stats);
      if (isOwnProfile) {
        setEditForm({
          username: data.stats.username,
          avatar: data.stats.avatar,
          bio: data.stats.bio || '',
          favoriteLanguage: data.stats.favoriteLanguage || 'javascript',
        });
      }
    } catch (err) {
      console.error('Profile error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMatches = async () => {
    try {
      const data = await getUserMatchHistory(userId, matchPage);
      setMatches(data.matches || []);
      setTotalMatchPages(data.pages || 1);
    } catch (err) {
      console.error('Match history error:', err);
    }
  };

  const handleSaveProfile = async () => {
    setEditError('');
    try {
      const data = await updateUserProfile(editForm);
      setStats(prev => ({ ...prev, ...data.user }));
      updateAuthUser(data.user);
      setEditing(false);
    } catch (err) {
      setEditError(err.message);
    }
  };

  if (loading) {
    return <div className="loading-container"><div className="loading-spinner" /></div>;
  }

  if (!stats) {
    return (
      <div className="page-container" style={{ textAlign: 'center' }}>
        <h2>Player not found 😕</h2>
        <button className="retro-btn retro-btn--primary" onClick={() => navigate('/dashboard')}>
          Go Home
        </button>
      </div>
    );
  }

  const AVATARS = ['🤖', '👾', '🎮', '🕹️', '🧑‍💻', '👨‍🚀', '🦊', '🐉', '🦄', '🔥', '⚡', '🌟', '🎯', '💎', '🏆', '🥷'];

  return (
    <div className="page-container">
      {/* Profile Header */}
      <div className="retro-card" style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1.5rem',
        marginBottom: '2rem',
        flexWrap: 'wrap',
      }}>
        <div style={{ fontSize: '4rem' }}>{stats.avatar || '🤖'}</div>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <h2 style={{ marginBottom: '0.25rem' }}>{stats.username}</h2>
          {stats.bio && (
            <p style={{ fontFamily: 'var(--font-heading)', color: 'var(--ink-light)', fontSize: '1.1rem' }}>
              {stats.bio}
            </p>
          )}
          <p style={{ fontFamily: 'var(--font-body)', color: 'var(--ink-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Joined {new Date(stats.createdAt).toLocaleDateString()} • Favorite: {stats.favoriteLanguage}
          </p>
        </div>
        {isOwnProfile && !editing && (
          <button className="retro-btn retro-btn--ghost" onClick={() => setEditing(true)}>
            ✏️ Edit
          </button>
        )}
      </div>

      {/* Edit Form */}
      {editing && (
        <div className="retro-card" style={{ marginBottom: '2rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>✏️ Edit Profile</h3>
          {editError && (
            <div style={{ background: 'var(--neon-pink)', color: 'white', padding: '0.5rem', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', border: '2px solid #000' }}>
              💥 {editError}
            </div>
          )}
          <div className="form-group">
            <label>Username</label>
            <input
              className="retro-input"
              value={editForm.username}
              onChange={(e) => setEditForm(p => ({ ...p, username: e.target.value }))}
              maxLength={20}
            />
          </div>
          <div className="form-group">
            <label>Avatar</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {AVATARS.map(a => (
                <button
                  key={a}
                  style={{
                    fontSize: '1.8rem',
                    padding: '0.25rem',
                    border: editForm.avatar === a ? '3px solid var(--orange-600)' : '2px solid transparent',
                    borderRadius: 'var(--radius-sm)',
                    background: 'transparent',
                    cursor: 'pointer',
                  }}
                  onClick={() => setEditForm(p => ({ ...p, avatar: a }))}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label>Bio (max 160 chars)</label>
            <input
              className="retro-input"
              value={editForm.bio}
              onChange={(e) => setEditForm(p => ({ ...p, bio: e.target.value }))}
              maxLength={160}
              placeholder="Tell the world about yourself..."
            />
          </div>
          <div className="form-group">
            <label>Favorite Language</label>
            <select
              className="retro-select"
              value={editForm.favoriteLanguage}
              onChange={(e) => setEditForm(p => ({ ...p, favoriteLanguage: e.target.value }))}
            >
              {LANGUAGES.map(lang => (
                <option key={lang.value} value={lang.value}>{lang.label}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="retro-btn retro-btn--primary" onClick={handleSaveProfile}>💾 Save</button>
            <button className="retro-btn retro-btn--ghost" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="stats-grid" style={{ marginBottom: '2rem' }}>
        <div className="stats-grid__item">
          <div className="stats-grid__value">{stats.currentStreak}</div>
          <div className="stats-grid__label">🔥 Current Streak</div>
        </div>
        <div className="stats-grid__item">
          <div className="stats-grid__value">{stats.highestStreak}</div>
          <div className="stats-grid__label">🏆 Best Streak</div>
        </div>
        <div className="stats-grid__item">
          <div className="stats-grid__value">{stats.totalWins}</div>
          <div className="stats-grid__label">✅ Wins</div>
        </div>
        <div className="stats-grid__item">
          <div className="stats-grid__value">{stats.totalLosses}</div>
          <div className="stats-grid__label">❌ Losses</div>
        </div>
        <div className="stats-grid__item">
          <div className="stats-grid__value">{stats.totalDraws}</div>
          <div className="stats-grid__label">🤝 Draws</div>
        </div>
        <div className="stats-grid__item">
          <div className="stats-grid__value">{stats.winRate}%</div>
          <div className="stats-grid__label">📊 Win Rate</div>
        </div>
        <div className="stats-grid__item">
          <div className="stats-grid__value">{stats.totalMatches}</div>
          <div className="stats-grid__label">🎮 Total Matches</div>
        </div>
        <div className="stats-grid__item">
          <div className="stats-grid__value" style={{ fontSize: '1.3rem' }}>{stats.favoriteLanguage}</div>
          <div className="stats-grid__label">💻 Fav Language</div>
        </div>
      </div>

      {/* Match History */}
      <div className="retro-card">
        <h3 style={{ marginBottom: '1rem' }}>⏱️ Match History</h3>
        {matches.length === 0 ? (
          <p style={{ fontFamily: 'var(--font-heading)', color: 'var(--ink-muted)' }}>
            No matches yet!
          </p>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table className="leaderboard-table">
                <thead>
                  <tr>
                    <th>Result</th>
                    <th>Opponent</th>
                    <th>Question</th>
                    <th>Language</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {matches.map(m => (
                    <tr key={m.id}>
                      <td>
                        <span className={`badge badge--${m.result === 'win' ? 'easy' : m.result === 'loss' ? 'hard' : 'medium'}`}>
                          {m.result === 'win' ? '🏆 Win' : m.result === 'loss' ? '💥 Loss' : '🤝 Draw'}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'var(--font-heading)' }}>
                        {m.opponent?.username || 'Unknown'}
                        {m.isMockMatch && ' 🤖'}
                      </td>
                      <td>
                        {m.questionTitle}
                        <span className={`badge badge--${m.questionDiff === 'Easy' ? 'easy' : m.questionDiff === 'Medium' ? 'medium' : 'hard'}`} style={{ marginLeft: '0.5rem' }}>
                          {m.questionDiff}
                        </span>
                      </td>
                      <td><span className="badge badge--lang">{m.language}</span></td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--ink-muted)' }}>
                        {new Date(m.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalMatchPages > 1 && (
              <div className="pagination">
                <button className="pagination__btn" onClick={() => setMatchPage(p => Math.max(1, p - 1))} disabled={matchPage <= 1}>
                  ← Prev
                </button>
                <span style={{ fontFamily: 'var(--font-heading)' }}>
                  Page {matchPage} of {totalMatchPages}
                </span>
                <button className="pagination__btn" onClick={() => setMatchPage(p => Math.min(totalMatchPages, p + 1))} disabled={matchPage >= totalMatchPages}>
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
