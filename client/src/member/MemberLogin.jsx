import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setMemberToken } from '../api.js';

export default function MemberLogin() {
  const [step, setStep] = useState('email'); // 'email' | 'code'
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const requestCode = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.memberLoginRequest(email.trim());
      setStep('code');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api.memberLoginVerify(email.trim(), code.trim());
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

        {step === 'email' ? (
          <form className="alogin-form" onSubmit={requestCode}>
            <h3>Member Sign In</h3>
            <p className="hint">Enter the e-mail you used to register.</p>

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

            <button className="btn btn-primary alogin-btn" disabled={busy || !email}>
              {busy ? <><span className="spinner" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,.35)', borderTopWidth: 2.5 }} /> Sending code…</> : 'Send Login Code →'}
            </button>

            <p className="alogin-foot">
              <a href="/">← Back to home</a>
            </p>
          </form>
        ) : (
          <form className="alogin-form" onSubmit={verifyCode}>
            <h3>Enter Your Code</h3>
            <p className="hint">We e-mailed a 6-digit code to {email}. It expires in 10 minutes.</p>

            {error && <div className="alogin-error">⚠ {error}</div>}

            <div className="afield">
              <label htmlFor="ml-code">Login Code</label>
              <div className="a-inputwrap">
                <span className="a-ico">🔑</span>
                <input
                  id="ml-code" type="text" inputMode="numeric" maxLength={6} value={code} autoFocus
                  placeholder="000000"
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                />
              </div>
            </div>

            <button className="btn btn-primary alogin-btn" disabled={busy || code.length !== 6}>
              {busy ? <><span className="spinner" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,.35)', borderTopWidth: 2.5 }} /> Verifying…</> : 'Sign In →'}
            </button>

            <p className="alogin-foot">
              <button type="button" className="link-btn" onClick={() => { setStep('email'); setCode(''); setError(null); }}>
                ← Use a different e-mail
              </button>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
