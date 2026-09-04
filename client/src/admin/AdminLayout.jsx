import { useEffect, useState } from 'react';
import { NavLink, Navigate, Outlet, useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { api, getToken, setToken, getSession, setSession } from '../api.js';

const NAV = [
  { to: '/admin', label: 'Overview', icon: '▦', end: true, screen: 'overview' },
  { to: '/admin/members', label: 'Members', icon: '👥', screen: 'members' },
  { to: '/admin/approvals', label: 'Approvals', icon: '☑', badge: 'pending', screen: 'approvals' },
  { to: '/admin/news', label: 'News & Events', icon: '📰', screen: 'events' },
  { to: '/admin/payments', label: 'Payments', icon: '₹', screen: 'payments' },
  { to: '/admin/receipts', label: 'Receipts', icon: '🧾', screen: 'payments' },
  { to: '/admin/accounts', label: 'Accounts', icon: '📒', screen: 'ledger' },
  { to: '/admin/form-builder', label: 'Form Builder', icon: '🛠', screen: 'form' },
  { to: '/admin/users', label: 'Users', icon: '🧑‍💼', screen: 'users' },
  { to: '/admin/settings', label: 'Settings', icon: '⚙', screen: 'settings' },
];

const ROLE_LABELS = { admin: 'Society Administrator', staff: 'Staff', accounts: 'Accounts' };

export function ScreenGuard({ screen }) {
  const ctx = useOutletContext();
  const session = getSession();
  const screens = session?.screens || [];
  if (!screens.includes(screen)) {
    const first = NAV.find((n) => screens.includes(n.screen));
    return <Navigate to={first ? first.to : '/admin/login'} replace />;
  }
  return <Outlet context={ctx} />;
}

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [stats, setStats] = useState(null);
  const [search, setSearch] = useState('');
  const session = getSession();
  const screens = session?.screens || [];

  const loadStats = async () => {
    if (!screens.includes('overview')) return;
    try {
      setStats(await api.stats());
    } catch (err) {
      if (err.status === 401) { setToken(null); setSession(null); navigate('/admin/login'); }
    }
  };

  useEffect(() => {
    if (getToken()) loadStats();
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!getToken() || !session) return <Navigate to="/admin/login" replace />;

  const logout = () => {
    setToken(null);
    setSession(null);
    sessionStorage.removeItem('reach_admin_user');
    navigate('/admin/login');
  };

  const submitSearch = (e) => {
    e.preventDefault();
    if (search.trim()) navigate(`/admin/members?search=${encodeURIComponent(search.trim())}`);
  };

  const pending = stats?.pending ?? 0;
  const visibleNav = NAV.filter((n) => screens.includes(n.screen));
  const displayName = session.full_name || session.username;

  return (
    <div className="ashell">
      <aside className="asidebar no-print">
        <div className="asb-logo">
          <img src="/api/logo" alt="REACH Pravasi Welfare Society" />
        </div>

        <div className="asb-section">Management</div>
        <nav className="asb-nav">
          {visibleNav.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `asb-link ${isActive ? 'active' : ''}`}>
              <span className="i">{item.icon}</span>
              <span className="t">{item.label}</span>
              {item.badge === 'pending' && pending > 0 && <span className="badge">{pending}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="asb-promo">
          <div className="p-t">Public Registration</div>
          <div className="p-d">Share the membership form with applicants.</div>
          <a href="/register" target="_blank" rel="noreferrer" className="p-btn">Open form ↗</a>
        </div>
      </aside>

      <div className="amain">
        <header className="atopbar no-print">
          <form className="atb-search" onSubmit={submitSearch}>
            <span className="s-ico">🔍</span>
            <input
              placeholder="Search members…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </form>
          <div className="atb-right">
            {screens.includes('approvals') && (
              <button
                className="atb-bell" title={`${pending} pending approval${pending === 1 ? '' : 's'}`}
                onClick={() => navigate('/admin/approvals')}
              >
                🔔
                {pending > 0 && <span className="dot" />}
              </button>
            )}
            <div className="atb-user">
              <div className="u-txt">
                <strong>{displayName}</strong>
                <span>{ROLE_LABELS[session.role] || session.role}</span>
              </div>
              <div className="u-avatar">{displayName.slice(0, 2).toUpperCase()}</div>
            </div>
            <button className="btn btn-outline btn-sm" onClick={logout}>Sign out</button>
          </div>
        </header>

        <main className="acontent">
          <Outlet context={{ stats, refreshStats: loadStats, session }} />
        </main>
      </div>
    </div>
  );
}
