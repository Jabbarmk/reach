import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { api, getMemberToken, setMemberToken } from '../api.js';
import MembershipCard from '../admin/MembershipCard.jsx';

const statusPill = (s) => {
  const map = {
    'Pending Verification': 'orange', 'Correction Requested': 'red', 'Payment Pending': 'blue',
    'Payment Verified': 'blue', Active: 'green', Approved: 'teal', Rejected: 'red',
  };
  return <span className={`pill ${map[s] || 'grey'}`}>{s}</span>;
};

export default function MemberDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        setData(await api.memberMe());
      } catch (err) {
        if (err.status === 401) { setMemberToken(null); navigate('/member/login'); return; }
        setError(err.message);
      }
    })();
  }, [navigate]);

  if (!getMemberToken()) return <Navigate to="/member/login" replace />;
  if (error) return <div className="empty-note"><div className="alert error">{error}</div></div>;
  if (!data) return <div className="empty-note"><span className="spinner lg" /></div>;

  const { application: app, payments, history } = data;
  const logout = () => { setMemberToken(null); navigate('/member/login'); };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>Welcome, {app.name}</h2>
        <button className="btn btn-outline btn-sm" onClick={logout}>Sign out</button>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {statusPill(app.status)}
          {app.payment_status === 'Paid' ? <span className="pill green">Paid</span> : <span className="pill grey">Unpaid</span>}
          <span className="pill blue">{app.plan_name}</span>
        </div>
        <div className="review-rows" style={{ padding: 0 }}>
          <div className="review-row"><div className="k">Reference No.</div><div className="v">{app.reference_no}</div></div>
          {app.membership_id && <div className="review-row"><div className="k">Membership ID</div><div className="v" style={{ fontFamily: 'monospace' }}>{app.membership_id}</div></div>}
          <div className="review-row"><div className="k">E-mail</div><div className="v">{app.email}</div></div>
        </div>
        {app.admin_note && <div className="alert info" style={{ marginTop: 12, marginBottom: 0 }}>Note from society office: {app.admin_note}</div>}
      </div>

      {app.membership_id && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, marginBottom: 12 }}>Membership Card</h2>
          <MembershipCard app={app} photoUrl={null} />
        </div>
      )}

      {payments.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, marginBottom: 12 }}>Payment History</h2>
          <div className="review-rows" style={{ padding: 0 }}>
            {payments.map((p) => (
              <div className="review-row" key={p.id}>
                <div className="k">{p.paid_on}</div>
                <div className="v">₹{Number(p.amount).toLocaleString('en-IN')} · {p.method}{p.receipt_number ? ` · ${p.receipt_number}` : ''}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="card">
          <h2 style={{ fontSize: 16, marginBottom: 12 }}>Updates</h2>
          <ul className="timeline">
            {history.map((h, i) => (
              <li key={i}>
                <div className="ta">{h.action}</div>
                {h.detail && <div className="td">{h.detail}</div>}
                <div className="tt">{new Date(h.created_at).toLocaleString('en-IN')}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
