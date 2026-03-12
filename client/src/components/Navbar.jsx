import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export default function Navbar() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="navbar">
      <div className="navbar__logo" onClick={() => navigate('/dashboard')}>
        🎮 CODE 1VS1
      </div>

      <div className="navbar__actions">
        {user && (
          <>
            <div className="navbar__streak">
              🔥 {user.currentStreak || 0}
            </div>
            <button
              className="retro-btn retro-btn--ghost"
              style={{ color: 'white', borderColor: '#555', padding: '0.4rem 0.8rem', fontSize: '0.9rem' }}
              onClick={() => navigate('/leaderboard')}
            >
              🏆 Leaderboard
            </button>
            {user.role === 'admin' && (
              <button
                className="retro-btn retro-btn--ghost"
                style={{ color: '#ffd700', borderColor: '#555', padding: '0.4rem 0.8rem', fontSize: '0.9rem' }}
                onClick={() => navigate('/admin/questions')}
              >
                ⚙️ Admin
              </button>
            )}
            <div
              className="navbar__user"
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(`/profile/${user.id}`)}
            >
              <span className="navbar__avatar">{user.avatar || '🤖'}</span>
              <span>{user.username}</span>
            </div>
            <button
              className="retro-btn retro-btn--ghost"
              style={{ color: '#ff006e', borderColor: '#555', padding: '0.4rem 0.8rem', fontSize: '0.9rem' }}
              onClick={handleLogout}
            >
              Logout
            </button>
          </>
        )}
      </div>
    </nav>
  );
}
