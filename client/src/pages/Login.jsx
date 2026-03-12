import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Login failed 💫');
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
      <span className="floating-emoji" style={{ top: '15%', left: '10%' }}>🔑</span>
      <span className="floating-emoji" style={{ top: '25%', right: '10%', animationDelay: '1s' }}>🎮</span>

      <div className="retro-card" style={{ maxWidth: '440px', width: '100%' }}>
        <h2 style={{
          textAlign: 'center',
          marginBottom: '0.25rem',
          color: 'var(--ink)',
          textShadow: '2px 2px 0 var(--orange-400)',
        }}>
          Welcome Back! 🎯
        </h2>
        <p style={{
          textAlign: 'center',
          fontFamily: 'var(--font-heading)',
          color: 'var(--ink-light)',
          marginBottom: '1.5rem',
          fontSize: '1.1rem',
        }}>
          Ready to crush some code?
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
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            className="retro-btn retro-btn--primary retro-btn--glow"
            type="submit"
            disabled={loading}
            style={{ width: '100%', marginTop: '0.5rem' }}
          >
            {loading ? '⏳ Logging in...' : '🚀 Login'}
          </button>
        </form>

        <p style={{
          textAlign: 'center',
          marginTop: '1.5rem',
          fontFamily: 'var(--font-heading)',
          fontSize: '1.05rem',
        }}>
          New here?{' '}
          <Link to="/register" style={{ fontWeight: 700 }}>
            Sign up & battle! ⚡
          </Link>
        </p>
      </div>
    </div>
  );
}
