import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setMemberToken } from '../api.js';

export default function MemberLogin() {
  const [email, setEmail] = useState('');
  const [memberId, setMemberId] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const login = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api.memberLogin(email.trim(), memberId.trim());
      setMemberToken(res.token);
      navigate('/member');
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="alogin-bg">
      <div className="alogin-glow g1" />
      <div className="alogin-glow g2" />

      <div className="alogin-card">
        <div className="alogin-brand">
          <span className="brand-logo-chip">
            <img src="/api/logo" alt="REACH Pravasi Welfare Society" />
          </span>
          <div className="divider" />
          <p className="desc">
            Member Login — check your application status, membership card and payment history.
          </p>
        </div>

        <form className="alogin-form" onSubmit={login}>
          <h3>Member Sign In</h3>
          <p className="hint">Enter your registered e-mail and Member ID.</p>

          {error && <div className="alogin-error">⚠ {error}</div>}

          <div className="afield">
            <label htmlFor="ml-email">E-mail</label>
            <div className="a-inputwrap">
              <span className="a-ico">✉</span>
              <input
                id="ml-email" type="email" value={email} autoFocus
                autoComplete="email" placeholder="you@example.com"
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="afield">
            <label htmlFor="ml-member-id">Member ID</label>
            <div className="a-inputwrap no-icon">
              <input
                id="ml-member-id" type="text" value={memberId}
                autoComplete="off" placeholder="REACH0005"
                onChange={(e) => setMemberId(e.target.value)}
              />
            </div>
          </div>

          <button className="btn btn-primary alogin-btn" disabled={busy || !email || !memberId}>
            {busy ? <><span className="spinner" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,.35)', borderTopWidth: 2.5 }} /> Signing in…</> : 'Sign In →'}
          </button>

          <p className="alogin-foot">
            <a href="/">← Back to home</a>
          </p>
        </form>
      </div>
    </div>
  );
}
