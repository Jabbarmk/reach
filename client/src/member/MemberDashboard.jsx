import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { api, fetchMemberPhotoBlob, getMemberToken, setMemberToken } from '../api.js';
import MembershipCard from '../admin/MembershipCard.jsx';
import MemberEditForm from './MemberEditForm.jsx';

const editRequestPill = (s) => {
  const map = { Pending: 'orange', Approved: 'green', Rejected: 'red' };
  return <span className={`pill ${map[s] || 'grey'}`}>{s}</span>;
};

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
  const [editRequest, setEditRequest] = useState(null);
  const [editing, setEditing] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(null);

  const load = async () => {
    try {
      const [me, reqRes] = await Promise.all([api.memberMe(), api.memberGetEditRequest()]);
      setData(me);
      setEditRequest(reqRes.request);
    } catch (err) {
      if (err.status === 401) { setMemberToken(null); navigate('/member/login'); return; }
      setError(err.message);
    }
  };

  useEffect(() => { load(); }, [navigate]);

  useEffect(() => {
    let cancelled = false;
    let url = null;
    (async () => {
      try { url = await fetchMemberPhotoBlob(); if (!cancelled) setPhotoUrl(url); }
      catch { /* no photo on file — placeholder is shown instead */ }
    })();
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [data?.application?.id]);

  if (!getMemberToken()) return <Navigate to="/member/login" replace />;
  if (error) return <div className="empty-note"><div className="alert error">{error}</div></div>;
  if (!data) return <div className="empty-note"><span className="spinner lg" /></div>;

  const { application: app, payments, history } = data;
  const logout = () => { setMemberToken(null); navigate('/member/login'); };
  const hasPendingRequest = editRequest?.status === 'Pending';

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

      {editRequest && editRequest.status !== 'Approved' && (
        <div className="alert" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {editRequestPill(editRequest.status)}
          <span>
            {editRequest.status === 'Pending'
              ? 'Your edit request is awaiting review by the society office.'
              : `Your last edit request was rejected${editRequest.admin_note ? `: ${editRequest.admin_note}` : '.'}`}
          </span>
        </div>
      )}

      {editing ? (
        <MemberEditForm
          app={app}
          onCancel={() => setEditing(false)}
          onSubmitted={async () => { setEditing(false); await load(); }}
        />
      ) : (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
          <button className="btn btn-outline btn-sm" onClick={() => setEditing(true)} disabled={hasPendingRequest}>
            {hasPendingRequest ? 'Edit request pending review' : '✎ Edit My Details'}
          </button>
        </div>
      )}

      {app.membership_id && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, marginBottom: 12 }}>Membership Card</h2>
          <MembershipCard app={app} photoUrl={photoUrl} />
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
