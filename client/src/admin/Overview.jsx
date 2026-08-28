import { useEffect, useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router-dom';
import { api, setToken } from '../api.js';
import { AppsTable } from './shared.jsx';

export default function Overview() {
  const { stats, session } = useOutletContext();
  const [recent, setRecent] = useState(null);
  const [reg, setReg] = useState(null);
  const [regBusy, setRegBusy] = useState(false);
  const navigate = useNavigate();
  const canToggle = session?.screens?.includes('settings');

  useEffect(() => {
    (async () => {
      try {
        const list = await api.listApplications({ status: 'All' });
        setRecent(list.slice(0, 8));
      } catch (err) {
        if (err.status === 401) { setToken(null); navigate('/admin/login'); }
      }
      try {
        const cfg = await api.formConfig();
        setReg(cfg.registration || { open: true });
      } catch { /* status stays unknown */ }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleReg = async () => {
    if (!canToggle || !reg) return;
    setRegBusy(true);
    try {
      setReg(await api.saveRegistration({ open: !reg.open }));
    } catch { /* keep current */ }
    finally { setRegBusy(false); }
  };

  const count = (name) => stats?.byStatus.find((r) => r.status === name)?.count || 0;
  const active = count('Active');
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const who = sessionStorage.getItem('reach_admin_user') || 'admin';

  const CARDS = [
    { label: 'Total members', value: stats?.total, ico: '👥', tone: 'blue', chip: stats?.recent ? `+${stats.recent} this month` : null },
    { label: 'Active members', value: active, ico: '✅', tone: 'green', chip: null },
    { label: 'Pending approvals', value: stats?.pending, ico: '⏳', tone: 'orange', chip: null, link: '/admin/approvals' },
    { label: 'Payments received', value: stats?.paid, ico: '₹', tone: 'teal', chip: null, link: '/admin/payments' },
  ];

  return (
    <>
      <div className="ovr-head">
        <div>
          <div className="ovr-date">{today}</div>
          <h1>Welcome back, {who === 'admin' ? 'Admin' : who}</h1>
          <p>Here is what's happening with the REACH community today.</p>
        </div>
        <a className="btn btn-primary" href="/register" target="_blank" rel="noreferrer">👤+ Register member</a>
      </div>

      {reg && (
        <div className={`reg-banner ${reg.open ? 'open' : 'closed'}`}>
          <span className="ri">{reg.open ? '🟢' : '🔒'}</span>
          <div style={{ flex: 1 }}>
            <strong>Membership registration is {reg.open ? 'OPEN' : 'CLOSED'}</strong>
            <div className="rd">
              {reg.open
                ? 'The public form is live and accepting applications.'
                : `Visitors currently see: “${reg.closed_message || 'New Membership Registration Temporarily Closed, Contact Admin'}”`}
            </div>
          </div>
          {canToggle && (
            <button
              type="button"
              className={`switch ${reg.open ? 'on' : ''}`}
              onClick={toggleReg}
              disabled={regBusy}
              aria-label="Toggle registration"
            >
              <span className="knob" />
            </button>
          )}
        </div>
      )}

      <div className="ovr-grid">
        {CARDS.map((c) => (
          <div
            key={c.label} className={`ovr-card ${c.link ? 'clickable' : ''}`}
            onClick={() => c.link && navigate(c.link)}
          >
            <div className="ovr-top">
              <span className={`ovr-ico ${c.tone}`}>{c.ico}</span>
              {c.chip && <span className="ovr-chip">{c.chip}</span>}
            </div>
            <div className="ovr-label">{c.label}</div>
            <div className="ovr-num">{c.value ?? '–'}</div>
          </div>
        ))}
      </div>

      <div className="ovr-recent-head">
        <h2>Recent applications</h2>
        <Link to="/admin/members">View all →</Link>
      </div>
      <AppsTable rows={recent} emptyText="No applications yet — share the registration form to get started." />
    </>
  );
}
