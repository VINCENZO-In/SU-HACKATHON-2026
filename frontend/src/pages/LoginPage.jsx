import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';

export default function LoginPage() {
  const [form, setForm]   = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const { login, loading } = useAuth();
  const { theme, setTheme, themes } = useTheme();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const result = await login(form.email, form.password);
    if (result.success) navigate('/');
    else setError(result.msg);
  };

  const demoLogin = (role) => {
    const creds = {
      admin:   { email: 'admin@weavemind.com',   password: 'admin123'   },
      manager: { email: 'manager@weavemind.com', password: 'manager123' },
      worker:  { email: 'worker@weavemind.com',  password: 'worker123'  },
    };
    setForm(creds[role]);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-0)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden'
    }}>
      {/* Animated grid */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'linear-gradient(var(--border) 1px,transparent 1px),linear-gradient(90deg,var(--border) 1px,transparent 1px)',
        backgroundSize: '60px 60px', opacity: 0.4
      }}/>
      {/* Glow orbs */}
      <div style={{ position: 'absolute', width: 500, height: 500, top: '-10%', left: '-10%', borderRadius: '50%', background: 'radial-gradient(circle,var(--accent-glow) 0%,transparent 70%)', pointerEvents: 'none' }}/>
      <div style={{ position: 'absolute', width: 400, height: 400, bottom: '-10%', right: '-10%', borderRadius: '50%', background: 'radial-gradient(circle,rgba(168,85,247,0.06) 0%,transparent 70%)', pointerEvents: 'none' }}/>

      {/* Theme switcher — top right */}
      <div style={{ position: 'fixed', top: 20, right: 20, display: 'flex', gap: 8, zIndex: 10 }}>
        {themes.map(t => (
          <button key={t.id} onClick={() => setTheme(t.id)} title={t.label}
            style={{
              width: 34, height: 34, borderRadius: '50%', border: '2px solid',
              borderColor: theme === t.id ? t.accent : 'var(--border)',
              background: theme === t.id ? t.accent + '22' : 'var(--bg-card)',
              cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.2s'
            }}>
            {t.icon}
          </button>
        ))}
      </div>

      <div style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 1, animation: 'fadeUp 0.5s ease' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 64, height: 64, background: 'var(--accent)', borderRadius: 18,
            marginBottom: 16, fontSize: 28, boxShadow: '0 8px 24px var(--accent-glow)'
          }}>🧵</div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-0)' }}>WEAVEMIND</h1>
          <p style={{ color: 'var(--text-2)', fontSize: 12, marginTop: 6, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Smart Textile Factory OS</p>
        </div>

        {/* Card */}
        <div className="card" style={{ padding: 32, borderColor: 'var(--border-bright)' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 600, marginBottom: 6 }}>Sign In</h2>
          <p style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 24 }}>Access your factory management dashboard</p>

          {error && <div className="alert alert-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input type="email" className="form-input" placeholder="admin@weavemind.com"
                value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required/>
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input type="password" className="form-input" placeholder="••••••••"
                value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required/>
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading}
              style={{ width: '100%', padding: '12px', fontSize: 15, marginTop: 8, letterSpacing: '0.06em' }}>
              {loading ? '⏳ Signing in...' : '→ ACCESS FACTORY OS'}
            </button>
          </form>

          {/* Demo logins */}
          <div style={{ marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
            <p style={{ fontSize: 11, color: 'var(--text-2)', textAlign: 'center', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Quick Demo Access</p>
            <div style={{ display: 'flex', gap: 8 }}>
              {['admin', 'manager', 'worker'].map(role => (
                <button key={role} onClick={() => demoLogin(role)}
                  style={{ flex: 1, padding: '8px 4px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text-1)', cursor: 'pointer', fontSize: 11, fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-1)'; }}>
                  {role}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
