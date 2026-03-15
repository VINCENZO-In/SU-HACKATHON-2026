import { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useAuth } from '../../hooks/useAuth';
import { useSocketEvent } from '../../hooks/useSocket';
import { useTheme } from '../../hooks/useTheme';

const NAV = [
  { to: '/',           label: 'Dashboard',   icon: '⬡',  exact: true },
  { to: '/machines',   label: 'Machines',    icon: '⚙'  },
  { to: '/maintenance',label: 'Maintenance', icon: '🔧' },
  { to: '/energy',     label: 'Energy',      icon: '⚡' },
  { to: '/inventory',  label: 'Inventory',   icon: '📦' },
  { to: '/quality',    label: 'Quality AI',  icon: '🔬' },
  { to: '/camera',     label: 'Live Camera', icon: '📷' },
  { to: '/jobs',       label: 'Production',  icon: '🏭' },
  { to: '/suppliers',  label: 'Suppliers',   icon: '🚚' },
  { to: '/orders',     label: 'Orders',      icon: '📋' },
  { to: '/ledger',     label: 'Ledger',      icon: '💰' },
  { to: '/payments',   label: 'Payments',    icon: '💸' },
  { to: '/reports',    label: 'Reports',     icon: '📊' },
  { to: '/users',      label: 'Users',       icon: '👥', adminOnly: true },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { theme, setTheme, themes } = useTheme();
  const navigate  = useNavigate();
  const location  = useLocation();
  const [alerts, setAlerts]       = useState([]);
  const [collapsed, setCollapsed] = useState(false);
  const [showTheme, setShowTheme] = useState(false);
  const [time, setTime]           = useState(new Date());
  const alertId = useRef(0);

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Push toast
  const pushAlert = (data) => {
    const id = ++alertId.current;
    setAlerts(prev => [...prev.slice(-4), { ...data, id }]);
    setTimeout(() => setAlerts(prev => prev.filter(a => a.id !== id)), 8000);
  };

  useSocketEvent('machine_alert', (d) =>
    pushAlert({ type: 'MACHINE ALERT', msg: d.machineId, sub: d.type, color: 'var(--red)', icon: '⚠️' }));

  useSocketEvent('maintenance_alert', (d) =>
    pushAlert({ type: 'MAINTENANCE', msg: d.name, sub: `${d.hoursRemaining}h remaining — ${d.urgency}`, color: 'var(--yellow)', icon: '🔧' }));

  useSocketEvent('quality_alert', (d) =>
    pushAlert({ type: 'QUALITY STOP', msg: d.machineId || 'Machine', sub: d.msg, color: 'var(--red)', icon: '⛔' }));

  useSocketEvent('payment_alert', (d) =>
    pushAlert({ type: 'PAYMENT OVERDUE', msg: d.party, sub: `₹${(d.amount||0).toLocaleString('en-IN')} — ${d.daysOverdue}d late`, color: 'var(--yellow)', icon: '💸' }));

  useSocketEvent('low_stock_alert', (d) =>
    pushAlert({ type: 'LOW STOCK', msg: d.itemName, sub: `Email sent to ${d.supplierName}`, color: 'var(--accent)', icon: '📦' }));

  const pageTitle = NAV.find(n => {
    if (n.exact) return location.pathname === '/';
    return location.pathname.startsWith(n.to) && n.to !== '/';
  })?.label || 'Dashboard';

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-0)' }}>

      {/* ── Sidebar ── */}
      <aside style={{
        width: collapsed ? 60 : 220,
        background: 'var(--bg-1)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        left: 0, top: 0, bottom: 0,
        zIndex: 200,
        overflow: 'hidden',
        transition: 'width 0.3s cubic-bezier(0.4,0,0.2,1)',
      }}>
        {/* Logo */}
        <div style={{ padding: '18px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, background: 'var(--accent)', borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, fontSize: 16, fontWeight: 800, color: '#000',
            boxShadow: '0 4px 14px var(--accent-glow)'
          }}>W</div>
          {!collapsed && (
            <div style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, letterSpacing: '0.07em', color: 'var(--text-0)' }}>WEAVEMIND</div>
              <div style={{ fontSize: 10, color: 'var(--text-2)', letterSpacing: '0.05em' }}>Factory OS v4</div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '10px 8px', overflowY: 'auto', overflowX: 'hidden' }}>
          {NAV.map(item => {
            if (item.adminOnly && user?.role !== 'admin') return null;
            return (
              <NavLink key={item.to} to={item.to} end={item.exact}
                style={({ isActive }) => ({
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: collapsed ? '10px' : '9px 10px',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  borderRadius: 8, marginBottom: 2,
                  textDecoration: 'none',
                  color: isActive ? 'var(--accent)' : 'var(--text-1)',
                  background: isActive ? 'var(--accent-glow)' : 'transparent',
                  fontFamily: 'var(--font-display)',
                  fontSize: 13, fontWeight: 600, letterSpacing: '0.03em',
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap',
                  borderLeft: isActive && !collapsed ? '2px solid var(--accent)' : '2px solid transparent',
                  paddingLeft: isActive && !collapsed ? '8px' : '10px',
                })}
                title={collapsed ? item.label : undefined}
              >
                <span style={{ fontSize: 15, flexShrink: 0 }}>{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* Theme picker */}
        <div style={{ padding: '8px', borderTop: '1px solid var(--border)' }}>
          {!collapsed && (
            <div style={{ position: 'relative', marginBottom: 8 }}>
              <button onClick={() => setShowTheme(s => !s)}
                style={{ width: '100%', padding: '8px 10px', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-1)', cursor: 'pointer', fontFamily: 'var(--font-display)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                <span>{themes.find(t => t.id === theme)?.icon} {themes.find(t => t.id === theme)?.label} Theme</span>
                <span style={{ fontSize: 10 }}>▾</span>
              </button>
              {showTheme && (
                <div style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border-bright)', borderRadius: 10, overflow: 'hidden', marginBottom: 4, zIndex: 999 }}>
                  {themes.map(t => (
                    <button key={t.id} onClick={() => { setTheme(t.id); setShowTheme(false); }}
                      style={{ width: '100%', padding: '9px 14px', background: theme === t.id ? 'var(--accent-glow)' : 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 600, color: theme === t.id ? 'var(--accent)' : 'var(--text-1)', display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left' }}>
                      <span>{t.icon}</span> {t.label}
                      {theme === t.id && <span style={{ marginLeft: 'auto', fontSize: 10 }}>✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* User + logout */}
          {!collapsed && (
            <div style={{ padding: '6px 10px', marginBottom: 4 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-0)' }}>{user?.name}</div>
              <div style={{ fontSize: 10, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 1 }}>{user?.role}</div>
            </div>
          )}
          <button onClick={() => { logout(); navigate('/login'); }}
            style={{ width: '100%', padding: '8px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'var(--font-display)', fontSize: 11, display: 'flex', alignItems: 'center', gap: 8, justifyContent: collapsed ? 'center' : 'flex-start', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--red)'; e.currentTarget.style.color = 'var(--red)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-2)'; }}>
            <span>⏻</span>{!collapsed && 'LOGOUT'}
          </button>
        </div>

        {/* Collapse toggle */}
        <button onClick={() => setCollapsed(c => !c)}
          style={{ position: 'absolute', right: -11, top: 28, width: 22, height: 22, background: 'var(--bg-2)', border: '1px solid var(--border-bright)', borderRadius: '50%', cursor: 'pointer', color: 'var(--text-1)', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 210, transition: 'all 0.15s' }}>
          {collapsed ? '›' : '‹'}
        </button>
      </aside>

      {/* ── Main ── */}
      <main style={{ marginLeft: collapsed ? 60 : 220, flex: 1, transition: 'margin-left 0.3s cubic-bezier(0.4,0,0.2,1)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

        {/* Topbar */}
        <header style={{
          background: 'var(--bg-1)', borderBottom: '1px solid var(--border)',
          padding: '0 28px', height: 54,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, zIndex: 100,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, letterSpacing: '0.04em', color: 'var(--text-0)' }}>
              {pageTitle}
            </h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {/* Live indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green)', animation: 'pulse-dot 2s infinite', boxShadow: '0 0 6px var(--green)' }}/>
              <span style={{ fontSize: 11, color: 'var(--green)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>LIVE</span>
            </div>
            {/* Clock */}
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-2)' }}>
              {time.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false })} IST
            </span>
            {/* User chip */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', background: 'var(--bg-2)', borderRadius: 20, border: '1px solid var(--border)' }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#000' }}>
                {user?.name?.[0]?.toUpperCase()}
              </div>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-0)' }}>{user?.name}</span>
              <span className="badge badge-blue" style={{ fontSize: 9 }}>{user?.role}</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <div style={{ padding: '24px 28px', flex: 1 }}>
          <Outlet />
        </div>
      </main>

      {/* ── Alert Toasts ── */}
      <div style={{ position: 'fixed', bottom: 24, right: 24, display: 'flex', flexDirection: 'column', gap: 10, zIndex: 9999, maxWidth: 320 }}>
        <AnimatePresence mode="popLayout">
          {alerts.map(a => (
            <div key={a.id}
              style={{
                background: 'var(--bg-card)',
                border: `1px solid ${a.color}44`,
                borderLeft: `3px solid ${a.color}`,
                borderRadius: 12,
                padding: '12px 16px',
                boxShadow: `0 8px 32px rgba(0,0,0,0.4), 0 0 12px ${a.color}18`,
                animation: 'fadeUp 0.3s ease',
                display: 'flex', alignItems: 'flex-start', gap: 10,
              }}>
              <span style={{ fontSize: 18 }}>{a.icon}</span>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ color: a.color, fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-display)', letterSpacing: '0.05em' }}>
                  {a.type}
                </div>
                <div style={{ color: 'var(--text-0)', fontSize: 12, fontWeight: 500, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {a.msg}
                </div>
                {a.sub && (
                  <div style={{ color: 'var(--text-1)', fontSize: 11, marginTop: 2 }}>{a.sub}</div>
                )}
              </div>
              <button onClick={() => setAlerts(prev => prev.filter(x => x.id !== a.id))}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-2)', cursor: 'pointer', fontSize: 14, padding: 0, flexShrink: 0 }}>✕</button>
            </div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
