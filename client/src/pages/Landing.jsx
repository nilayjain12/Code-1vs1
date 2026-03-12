import { useNavigate } from 'react-router-dom';

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', position: 'relative', overflow: 'hidden' }}>
      {/* Floating decorative emojis */}
      <span className="floating-emoji" style={{ top: '10%', left: '5%', animationDelay: '0s' }}>🎮</span>
      <span className="floating-emoji" style={{ top: '20%', right: '8%', animationDelay: '1s' }}>⚡</span>
      <span className="floating-emoji" style={{ top: '60%', left: '3%', animationDelay: '2s' }}>🔥</span>
      <span className="floating-emoji" style={{ top: '70%', right: '5%', animationDelay: '0.5s' }}>🏆</span>
      <span className="floating-emoji" style={{ top: '40%', left: '12%', animationDelay: '1.5s' }}>💥</span>
      <span className="floating-emoji" style={{ top: '85%', right: '15%', animationDelay: '3s' }}>🤖</span>
      <span className="floating-emoji" style={{ top: '15%', left: '40%', animationDelay: '2.5s' }}>⌨️</span>

      {/* Hero Section */}
      <div style={{ textAlign: 'center', paddingTop: '8vh' }}>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(3rem, 8vw, 6rem)',
          color: 'var(--ink)',
          textShadow: '4px 4px 0 var(--orange-500)',
          marginBottom: '0.5rem',
          lineHeight: 1.1,
        }}>
          CODE 1VS1
        </h1>

        <p style={{
          fontFamily: 'var(--font-heading)',
          fontSize: 'clamp(1.2rem, 3vw, 1.8rem)',
          color: 'var(--ink-light)',
          maxWidth: '600px',
          margin: '0 auto 2rem',
          padding: '0 1rem',
        }}>
          Arcade coding battles 🎯
        </p>

        {/* CTA Buttons */}
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '3rem', padding: '0 1rem' }}>
          <button
            className="retro-btn retro-btn--primary retro-btn--large retro-btn--glow"
            onClick={() => navigate('/register')}
          >
            🚀 Sign Up & Battle
          </button>
          <button
            className="retro-btn retro-btn--ghost retro-btn--large"
            onClick={() => navigate('/login')}
          >
            🔑 Login
          </button>
        </div>

        {/* Feature Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1.5rem',
          maxWidth: '1000px',
          margin: '0 auto',
          padding: '0 2rem',
        }}>
          <div className="retro-card retro-card--tilted" style={{ textAlign: 'left' }}>
            <h3 style={{ marginBottom: '0.5rem' }}>⚔️ Real-Time Battles</h3>
            <p style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', color: 'var(--ink-light)' }}>
              Match against real developers or AI bots. Solve DSA challenges head-to-head with a ticking clock!
            </p>
          </div>

          <div className="retro-card retro-card--tilted" style={{ textAlign: 'left', transform: 'rotate(1deg)' }}>
            <h3 style={{ marginBottom: '0.5rem' }}>🔥 Build Streaks</h3>
            <p style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', color: 'var(--ink-light)' }}>
              Win matches to build your streak. Climb the global leaderboard and earn legendary status!
            </p>
          </div>

          <div className="retro-card retro-card--tilted" style={{ textAlign: 'left' }}>
            <h3 style={{ marginBottom: '0.5rem' }}>🌐 8 Languages</h3>
            <p style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', color: 'var(--ink-light)' }}>
              Code in JavaScript, Python, C++, Java, TypeScript, Go, Rust, or C#. Your arena, your language.
            </p>
          </div>
        </div>

        {/* Bottom Tagline */}
        <div style={{
          marginTop: '4rem',
          padding: '2rem',
          background: 'var(--ink)',
          borderTop: 'var(--border-chunky)',
        }}>
          <p style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.5rem',
            color: 'var(--orange-500)',
            letterSpacing: '2px',
          }}>
            🏆 JOIN THE LEADERBOARD. CRUSH THE COMPETITION. 🏆
          </p>
          <p style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '1.1rem',
            color: 'var(--cream-dark)',
            marginTop: '0.5rem',
          }}>
            Anti-cheat protected • Fair play guaranteed • No tab-switching allowed
          </p>
        </div>
      </div>
    </div>
  );
}
