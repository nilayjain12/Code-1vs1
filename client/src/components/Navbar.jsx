import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useGameStore } from '../store/gameStore';
import { getSocket } from '../lib/socket';
import ConfirmModal from './ConfirmModal';

const MODAL_CONFIGS = {
  home: {
    title: 'Leaving the Arena',
    message: 'Exiting will forfeit your current match. Your opponent wins by default. Continue anyway?',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    danger: true,
    forfeit: true,
    path: '/dashboard',
  },
  leaderboard: {
    title: 'View Leaderboard',
    message: 'Your match will be paused while viewing the leaderboard. You can resume when you return. Proceed?',
    confirmText: 'Continue',
    cancelText: 'Cancel',
    danger: false,
    forfeit: false,
    path: '/leaderboard',
  },
  admin: {
    title: 'Admin Access',
    message: 'Switching to admin panel will end your current match. Continue to dashboard?',
    confirmText: 'Go to Admin',
    cancelText: 'Cancel',
    danger: true,
    forfeit: true,
    path: '/admin/questions',
  },
  profile: {
    title: 'View Profile',
    message: 'Your match will be paused while viewing your profile. You can resume when you return. Continue?',
    confirmText: 'View Profile',
    cancelText: 'Cancel',
    danger: false,
    forfeit: false,
    path: null, // dynamic
  },
  logout: {
    title: 'Exit Session',
    message: 'Logging out will forfeit any active matches. Are you sure you want to leave the CODE TWST arena?',
    confirmText: 'Logout',
    cancelText: 'Cancel',
    danger: true,
    forfeit: true,
    path: null, // handled specially
  },
};

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const { currentMatch, clearMatch } = useGameStore();
  const [modal, setModal] = useState(null);

  const isInArena = location.pathname === '/arena' && !!currentMatch;

  const handleNavAction = (key, dynamicPath) => {
    if (!isInArena) {
      // No active match — just navigate directly
      if (key === 'logout') {
        logout();
        navigate('/');
        return;
      }
      navigate(dynamicPath || MODAL_CONFIGS[key].path);
      return;
    }
    // Active match — show confirmation
    setModal({ key, dynamicPath });
  };

  const handleConfirm = () => {
    if (!modal) return;
    const config = MODAL_CONFIGS[modal.key];

    // If this action forfeits the match, emit forfeit
    if (config.forfeit && currentMatch) {
      const socket = getSocket();
      if (socket) socket.emit('forfeit', { roomId: currentMatch.roomId });
      clearMatch();
    }

    if (modal.key === 'logout') {
      logout();
      navigate('/');
    } else {
      navigate(modal.dynamicPath || config.path);
    }

    setModal(null);
  };

  const handleClose = () => setModal(null);

  const activeConfig = modal ? MODAL_CONFIGS[modal.key] : null;

  return (
    <>
      <nav className="navbar">
        <div className="navbar__logo" onClick={() => handleNavAction('home')}>
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
                onClick={() => handleNavAction('leaderboard')}
              >
                🏆 Leaderboard
              </button>
              {user.role === 'admin' && (
                <button
                  className="retro-btn retro-btn--ghost"
                  style={{ color: '#ffd700', borderColor: '#555', padding: '0.4rem 0.8rem', fontSize: '0.9rem' }}
                  onClick={() => handleNavAction('admin')}
                >
                  ⚙️ Admin
                </button>
              )}
              <div
                className="navbar__user"
                style={{ cursor: 'pointer' }}
                onClick={() => handleNavAction('profile', `/profile/${user.id}`)}
              >
                <span className="navbar__avatar">{user.avatar || '🤖'}</span>
                <span>{user.username}</span>
              </div>
              <button
                className="retro-btn retro-btn--ghost"
                style={{ color: '#ff006e', borderColor: '#555', padding: '0.4rem 0.8rem', fontSize: '0.9rem' }}
                onClick={() => handleNavAction('logout')}
              >
                Logout
              </button>
            </>
          )}
        </div>
      </nav>

      {activeConfig && (
        <ConfirmModal
          title={activeConfig.title}
          message={activeConfig.message}
          confirmText={activeConfig.confirmText}
          cancelText={activeConfig.cancelText}
          danger={activeConfig.danger}
          onConfirm={handleConfirm}
          onClose={handleClose}
        />
      )}
    </>
  );
}
