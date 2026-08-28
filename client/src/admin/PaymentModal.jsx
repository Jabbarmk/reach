import { useEffect, useState } from 'react';
import { api } from '../api.js';

/**
 * Payment dialog used for: recording a payment (mode 'record'),
 * the approve flow (mode 'approve': record+approve or approve only),
 * and editing an existing payment (mode 'edit').
 */
export default function PaymentModal({ mode, app, payment, onClose, onDone }) {
  const [plans, setPlans] = useState([]);
  const [methods, setMethods] = useState([]);
  const [amountChoice, setAmountChoice] = useState('');
  const [customAmount, setCustomAmount] = useState('');
  const [method, setMethod] = useState(payment?.method || '');
  const [paidOn, setPaidOn] = useState(payment?.paid_on || new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState(payment?.note || '');
  const [receipt, setReceipt] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const cfg = await api.formConfig();
        setPlans(cfg.plans || []);
        setMethods(cfg.options?.payment_method || ['Cash', 'Bank Transfer', 'Google Pay', 'UPI', 'Cheque']);
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

  const buildForm = () => {
    const fd = new FormData();
    fd.append('amount', amount);
    fd.append('method', method);
    fd.append('paid_on', paidOn);
    if (note.trim()) fd.append('note', note.trim());
    if (receipt) fd.append('receipt', receipt);
    return fd;
  };

  const validate = () => {
    if (!(Number(amount) > 0)) { setError('Enter a valid amount.'); return false; }
    if (!method) { setError('Select a payment method.'); return false; }
    if (!paidOn) { setError('Select the payment date.'); return false; }
    return true;
  };

  const submitPayment = async (withApprove) => {
    setError(null);
    if (!validate()) return;
    setBusy(true);
    try {
      if (mode === 'edit') {
        await api.updatePayment(payment.id, buildForm());
      } else {
        const fd = buildForm();
        fd.append('application_id', app.id);
        if (withApprove) fd.append('approve', '1');
        await api.createPayment(fd);
      }
      onDone();
    } catch (err) { setError(err.message); setBusy(false); }
  };

  const approveOnly = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.action(app.id, 'approve');
      onDone();
    } catch (err) { setError(err.message); setBusy(false); }
  };

  const dedupePlans = [];
  const seenFees = new Set();
  for (const p of plans) {
    if (seenFees.has(Number(p.fee))) continue;
    seenFees.add(Number(p.fee));
    dedupePlans.push(p);
  }

  return (
    <div className="modal-overlay">
      <div className="crop-modal" style={{ maxWidth: 500 }}>
        <div className="crop-head">
          <h3>
            {mode === 'approve' && 'Approve — Record payment now?'}
            {mode === 'record' && 'Record Payment'}
            {mode === 'edit' && 'Edit Payment'}
          </h3>
          <p>
            {app?.name}{app?.membership_id ? ` · ${app.membership_id}` : ''}
            {mode === 'approve' && ' — the membership ID is generated either way.'}
          </p>
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
              <label>Payment Date <span className="req">*</span></label>
              <input type="date" value={paidOn} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setPaidOn(e.target.value)} />
            </div>
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
          {mode === 'approve' && (
            <button className="btn btn-outline btn-sm" onClick={approveOnly} disabled={busy}>
              Approve Only (payment later)
            </button>
          )}
          <button className="btn btn-green btn-sm" onClick={() => submitPayment(mode === 'approve')} disabled={busy}>
            {busy ? 'Saving…' :
              mode === 'approve' ? '₹ Record Payment & Approve' :
              mode === 'edit' ? 'Save Changes' : '₹ Record Payment'}
          </button>
        </div>
      </div>
    </div>
  );
}
