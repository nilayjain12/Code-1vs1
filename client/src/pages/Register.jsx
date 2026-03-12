import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export default function Register() {
  const navigate = useNavigate();
  const { register } = useAuthStore();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError('Passwords don\'t match! 🤔');
      return;
    }
    if (password.length < 8) {
      setError('Password needs at least 8 characters! 💪');
      return;
    }
    if (username.length < 3 || username.length > 20) {
      setError('Username must be 3-20 characters! 📝');
      return;
    }

    setLoading(true);
    try {
      await register(email, password, username);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Registration failed 💫');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--cream)',
      padding: '2rem',
      position: 'relative',
    }}>
      <span className="floating-emoji" style={{ top: '10%', right: '8%' }}>⚡</span>
      <span className="floating-emoji" style={{ bottom: '15%', left: '8%', animationDelay: '1.5s' }}>🚀</span>

      <div className="retro-card" style={{ maxWidth: '440px', width: '100%' }}>
        <h2 style={{
          textAlign: 'center',
          marginBottom: '0.25rem',
          color: 'var(--ink)',
          textShadow: '2px 2px 0 var(--orange-400)',
        }}>
          Join the Arena! 🏟️
        </h2>
        <p style={{
          textAlign: 'center',
          fontFamily: 'var(--font-heading)',
          color: 'var(--ink-light)',
          marginBottom: '1.5rem',
          fontSize: '1.1rem',
        }}>
          Create your warrior account
        </p>

        {error && (
          <div style={{
            background: 'var(--neon-pink)',
            color: 'white',
            padding: '0.75rem',
            borderRadius: 'var(--radius-md)',
            marginBottom: '1rem',
            fontFamily: 'var(--font-heading)',
            border: '2px solid #000',
          }}>
            💥 {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Username</label>
            <input
              className="retro-input"
              type="text"
              placeholder="CodeWarrior42"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={3}
              maxLength={20}
            />
          </div>

          <div className="form-group">
            <label>Email</label>
            <input
              className="retro-input"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              className="retro-input"
              type="password"
              placeholder="Min. 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>

          <div className="form-group">
            <label>Confirm Password</label>
            <input
              className="retro-input"
              type="password"
              placeholder="Type it again"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </div>

          <button
            className="retro-btn retro-btn--primary retro-btn--glow"
            type="submit"
            disabled={loading}
            style={{ width: '100%', marginTop: '0.5rem' }}
          >
            {loading ? '⏳ Creating account...' : '⚔️ Create Account'}
          </button>
        </form>

        <p style={{
          textAlign: 'center',
          marginTop: '1.5rem',
          fontFamily: 'var(--font-heading)',
          fontSize: '1.05rem',
        }}>
          Already have an account?{' '}
          <Link to="/login" style={{ fontWeight: 700 }}>
            Login here! 🔑
          </Link>
        </p>
      </div>
    </div>
  );
}
