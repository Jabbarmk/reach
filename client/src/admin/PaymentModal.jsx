import { useEffect, useState } from 'react';
import { api, getSession } from '../api.js';

/**
 * Payment dialog used for: recording/verifying a payment (mode 'record')
 * and editing an existing payment (mode 'edit'). Approval is a separate,
 * later step handled elsewhere once payment is verified.
 */
export default function PaymentModal({ mode, app, payment, onClose, onDone }) {
  const session = getSession();
  const isAdmin = session?.role === 'admin';
  const [plans, setPlans] = useState([]);
  const [methods, setMethods] = useState([]);
  const [collectors, setCollectors] = useState([]);
  const [amountChoice, setAmountChoice] = useState('');
  const [customAmount, setCustomAmount] = useState('');
  const [method, setMethod] = useState(payment?.method || '');
  const [collectedBy, setCollectedBy] = useState(
    isAdmin ? (payment?.collected_by || session?.username || '') : (session?.username || '')
  );
  const [paidOn, setPaidOn] = useState(payment?.paid_on || new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState(payment?.note || '');
  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [cfg, collectorList] = await Promise.all([api.formConfig(), api.listCollectors()]);
        setPlans(cfg.plans || []);
        setMethods(cfg.options?.payment_method || ['Cash', 'Bank Transfer', 'Google Pay', 'UPI', 'Cheque']);
        setCollectors(collectorList || []);
        const registeredFee = payment?.amount != null
          ? Number(payment.amount)
          : Number(app?.membership_fee ?? cfg.plans?.find((p) => p.code === app?.membership_type)?.fee ?? '');
        const match = (cfg.plans || []).find((p) => Number(p.fee) === registeredFee);
        if (match) setAmountChoice(String(match.fee));
        else if (registeredFee) { setAmountChoice('other'); setCustomAmount(String(registeredFee)); }
      } catch { setMethods(['Cash', 'Bank Transfer', 'Google Pay', 'UPI', 'Cheque']); }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const amount = amountChoice === 'other' ? customAmount : amountChoice;

  const dedupePlans = [];
  const seenFees = new Set();
  for (const p of plans) {
    if (seenFees.has(Number(p.fee))) continue;
    seenFees.add(Number(p.fee));
    dedupePlans.push(p);
  }
  // The amount choice matches a specific plan's fee — if it's a different plan than the
  // member actually registered under, verifying/saving this payment will switch their plan.
  const selectedPlan = amountChoice !== 'other' ? dedupePlans.find((p) => String(p.fee) === amountChoice) : null;
  const planMismatch = selectedPlan && app?.membership_type && selectedPlan.code !== app.membership_type;

  const buildForm = () => {
    const fd = new FormData();
    fd.append('amount', amount);
    fd.append('method', method);
    fd.append('collected_by', collectedBy);
    fd.append('paid_on', paidOn);
    if (note.trim()) fd.append('note', note.trim());
    if (receipt) fd.append('receipt', receipt);
    if (planMismatch) fd.append('membership_type', selectedPlan.code);
    return fd;
  };

  const validate = () => {
    if (!(Number(amount) > 0)) { setError('Enter a valid amount.'); return false; }
    if (!method) { setError('Select a payment method.'); return false; }
    if (!collectedBy) { setError('Select who collected the cash.'); return false; }
    if (!paidOn) { setError('Select the payment date.'); return false; }
    return true;
  };

  const submitPayment = async () => {
    setError(null);
    if (!validate()) return;
    if (planMismatch) {
      const currentPlanName = plans.find((p) => p.code === app.membership_type)?.name || app.membership_type;
      const ok = window.confirm(
        `This amount matches "${selectedPlan.name}", not the registered plan "${currentPlanName}". ` +
        `Continuing will change ${app?.name || 'this member'}'s membership plan to "${selectedPlan.name}". Continue?`
      );
      if (!ok) return;
    }
    setBusy(true);
    try {
      if (mode === 'edit') {
        await api.updatePayment(payment.id, buildForm());
      } else {
        const fd = buildForm();
        fd.append('application_id', app.id);
        await api.createPayment(fd);
      }
      onDone();
    } catch (err) { setError(err.message); setBusy(false); }
  };

  return (
    <div className="modal-overlay">
      <div className="crop-modal" style={{ maxWidth: 500 }}>
        <div className="crop-head">
          <h3>{mode === 'edit' ? 'Edit Payment' : 'Verify Payment'}</h3>
          <p>{app?.name}{app?.membership_id ? ` · ${app.membership_id}` : ''}</p>
        </div>
        <div style={{ padding: '16px 20px', maxHeight: '58vh', overflowY: 'auto' }}>
          {error && <div className="alert error">{error}</div>}
          <div className="field">
            <label>Amount (₹) <span className="req">*</span></label>
            <select value={amountChoice} onChange={(e) => setAmountChoice(e.target.value)}>
              <option value="" disabled>Select amount…</option>
              {dedupePlans.map((p) => (
                <option key={p.code} value={String(p.fee)}>
                  ₹{Number(p.fee).toLocaleString('en-IN')} — {p.name}
                  {app?.membership_type === p.code ? ' (registered plan)' : ''}
                </option>
              ))}
              <option value="other">Other amount…</option>
            </select>
            {amountChoice === 'other' && (
              <input
                type="number" min="1" placeholder="Enter amount" value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)} style={{ marginTop: 8 }}
              />
            )}
            {planMismatch && (
              <div className="hint" style={{ color: 'var(--orange-500)', marginTop: 6 }}>
                ⚠ This matches "{selectedPlan.name}" — saving will change {app?.name || 'this member'}'s registered plan to match.
              </div>
            )}
          </div>
          <div className="grid2">
            <div className="field">
              <label>Payment Method <span className="req">*</span></label>
              <select value={method} onChange={(e) => setMethod(e.target.value)}>
                <option value="" disabled>Select method…</option>
                {methods.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Cash Collected By <span className="req">*</span></label>
              {isAdmin ? (
                <select value={collectedBy} onChange={(e) => setCollectedBy(e.target.value)}>
                  <option value="" disabled>Select user…</option>
                  {collectors.map((c) => <option key={c.username} value={c.username}>{c.name} — {c.roleLabel}</option>)}
                </select>
              ) : (
                <input
                  type="text" disabled
                  value={(() => {
                    const c = collectors.find((x) => x.username === collectedBy);
                    return c ? `${c.name} — ${c.roleLabel}` : (session?.full_name || session?.username || '');
                  })()}
                />
              )}
            </div>
          </div>
          <div className="field">
            <label>Payment Date <span className="req">*</span></label>
            <input type="date" value={paidOn} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setPaidOn(e.target.value)} />
          </div>
          <div className="field">
            <label>Note</label>
            <input type="text" value={note} placeholder="e.g. transaction reference" onChange={(e) => setNote(e.target.value)} />
          </div>
          <div className="field">
            <label>Receipt / Proof {payment?.receipt_doc_id ? <span className="opt">(uploaded — choose a file to replace)</span> : <span className="opt">(optional)</span>}</label>
            <input
              type="file" accept="application/pdf,image/jpeg,image/png"
              onChange={(e) => setReceipt(e.target.files?.[0] || null)}
            />
            <div className="hint">PDF, JPG or PNG, up to 5 MB</div>
          </div>
        </div>
        <div className="crop-actions" style={{ flexWrap: 'wrap' }}>
          <button className="btn btn-outline btn-sm" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn btn-green btn-sm" onClick={submitPayment} disabled={busy}>
            {busy ? 'Saving…' : mode === 'edit' ? 'Save Changes' : '💳 Verify Payment'}
          </button>
        </div>
      </div>
    </div>
  );
}
