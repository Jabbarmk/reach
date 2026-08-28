import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setToken, setSession } from '../api.js';

export default function AdminLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api.login(username, password);
      setToken(res.token);
      sessionStorage.setItem('reach_admin_user', res.username);
      setSession({ username: res.username, full_name: res.full_name, role: res.role, screens: res.screens });
      navigate('/admin');
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
            Membership Management System — review applications, verify documents
            and manage member records.
          </p>
          <ul className="feat">
            <li>Pending approvals &amp; verification</li>
            <li>Document review with OCR results</li>
            <li>Membership ID &amp; card generation</li>
          </ul>
        </div>

        <form className="alogin-form" onSubmit={submit}>
          <h3>Administrator Sign In</h3>
          <p className="hint">Restricted area — authorised administrators only.</p>

          {error && <div className="alogin-error">⚠ {error}</div>}

          <div className="afield">
            <label htmlFor="al-user">Username</label>
            <div className="a-inputwrap">
              <span className="a-ico">👤</span>
              <input
                id="al-user" type="text" value={username} autoFocus
                autoComplete="username" placeholder="Enter username"
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
          </div>

          <div className="afield">
            <label htmlFor="al-pass">Password</label>
            <div className="a-inputwrap">
              <span className="a-ico">🔒</span>
              <input
                id="al-pass" type={showPw ? 'text' : 'password'} value={password}
                autoComplete="current-password" placeholder="Enter password"
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button" className="a-eye" tabIndex={-1}
                aria-label={showPw ? 'Hide password' : 'Show password'}
                onClick={() => setShowPw(!showPw)}
              >
                {showPw ? '🙈' : '👁'}
              </button>
            </div>
          </div>

          <button className="btn btn-primary alogin-btn" disabled={busy || !username || !password}>
            {busy ? <><span className="spinner" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,.35)', borderTopWidth: 2.5 }} /> Signing in…</> : 'Sign In →'}
          </button>

          <p className="alogin-foot">
            <a href="/">← Back to registration</a>
          </p>
        </form>
      </div>
    </div>
  );
}
