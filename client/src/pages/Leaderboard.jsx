import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { getLeaderboard, getUserRank } from '../lib/api';

const SORT_OPTIONS = [
  { value: 'streak', label: '🔥 By Streak' },
  { value: 'wins', label: '🏆 By Total Wins' },
  { value: 'winrate', label: '📊 By Win Rate' },
  { value: 'recent', label: '⏱️ Most Active' },
];

export default function Leaderboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [leaderboard, setLeaderboard] = useState([]);
  const [sortBy, setSortBy] = useState('streak');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [myRank, setMyRank] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, [sortBy, page]);

  useEffect(() => {
    if (user?.id) {
      getUserRank(user.id).then(data => setMyRank(data)).catch(() => {});
    }
  }, [user?.id]);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const data = await getLeaderboard(sortBy, page);
      setLeaderboard(data.users || []);
      setTotalPages(data.pages || 1);
    } catch (err) {
      console.error('Leaderboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getRankDisplay = (rank) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>🏆 Leaderboard</h1>
        <p>Top coders ranked by glory</p>
      </div>

      {/* My Rank Card */}
      {myRank && (
        <div className="retro-card retro-card--orange" style={{
          textAlign: 'center',
          marginBottom: '2rem',
          maxWidth: '500px',
          marginLeft: 'auto',
          marginRight: 'auto',
        }}>
          <h3 style={{ color: 'white', marginBottom: '0.25rem' }}>Your Position</h3>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '3rem', color: 'white' }}>
            {getRankDisplay(myRank.rank)}
          </div>
          <p style={{ fontFamily: 'var(--font-heading)', color: 'rgba(255,255,255,0.8)' }}>
            Top {myRank.percentile}% of all players • Streak: {myRank.user?.currentStreak || 0}
          </p>
        </div>
      )}

      {/* Sort Options */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        {SORT_OPTIONS.map(opt => (
          <button
            key={opt.value}
            className={`retro-btn ${sortBy === opt.value ? 'retro-btn--primary' : 'retro-btn--ghost'}`}
            style={{ fontSize: '0.9rem', padding: '0.4rem 0.8rem' }}
            onClick={() => { setSortBy(opt.value); setPage(1); }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Leaderboard Table */}
      {loading ? (
        <div className="loading-container"><div className="loading-spinner" /></div>
      ) : (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Player</th>
                  <th>Streak</th>
                  <th>Win Rate</th>
                  <th>Wins</th>
                  <th>Matches</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((entry) => (
                  <tr key={entry.id} className={entry.id === user?.id ? 'current-user' : ''}>
                    <td className={`rank-cell ${entry.rank <= 3 ? `rank-${entry.rank}` : ''}`}>
                      {getRankDisplay(entry.rank)}
                    </td>
                    <td
                      className="username-cell"
                      onClick={() => navigate(`/profile/${entry.id}`)}
                    >
                      <span style={{ marginRight: '0.4rem' }}>{entry.avatar}</span>
                      {entry.username}
                    </td>
                    <td>
                      <span className="badge badge--streak">🔥 {entry.currentStreak}</span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{entry.winRate}%</td>
                    <td>{entry.totalWins}</td>
                    <td>{entry.totalMatches}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {leaderboard.length === 0 && (
            <div style={{ textAlign: 'center', padding: '2rem', fontFamily: 'var(--font-heading)', fontSize: '1.2rem', color: 'var(--ink-muted)' }}>
              No players yet! Be the first to compete 🎮
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pagination">
              <button
                className="pagination__btn"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                ← Prev
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const pageNum = i + 1;
                return (
                  <button
                    key={pageNum}
                    className={`pagination__btn ${page === pageNum ? 'pagination__btn--active' : ''}`}
                    onClick={() => setPage(pageNum)}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                className="pagination__btn"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
