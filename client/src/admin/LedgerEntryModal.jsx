import { useEffect, useState } from 'react';
import { api } from '../api.js';

const KIND_LABEL = { received: 'Money Received', expense: 'Payment / Expense' };

export default function LedgerEntryModal({ mode, kind, entry, onClose, onDone }) {
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState(entry?.category_id ? String(entry.category_id) : '');
  const [amount, setAmount] = useState(entry?.amount ? String(entry.amount) : '');
  const [entryDate, setEntryDate] = useState(entry?.entry_date?.slice(0, 10) || new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState(entry?.method || '');
  const [note, setNote] = useState(entry?.note || '');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.listLedgerCategories(kind);
        setCategories(res.categories || []);
      } catch { /* leave empty; select will show none */ }
    })();
  }, [kind]);

  const validate = () => {
    if (!categoryId) { setError('Select a category.'); return false; }
    if (!(Number(amount) > 0)) { setError('Enter a valid amount.'); return false; }
    if (!entryDate) { setError('Select a date.'); return false; }
    return true;
  };

  const submit = async () => {
    setError(null);
    if (!validate()) return;
    setBusy(true);
    try {
      const payload = { category_id: categoryId, amount, entry_date: entryDate, method: method.trim(), note: note.trim() };
      if (mode === 'edit') {
        await api.updateLedgerEntry(entry.id, payload);
      } else {
        await api.createLedgerEntry({ kind, ...payload });
      }
      onDone();
    } catch (err) { setError(err.message); setBusy(false); }
  };

  return (
    <div className="modal-overlay">
      <div className="crop-modal" style={{ maxWidth: 460 }}>
        <div className="crop-head">
          <h3>{mode === 'edit' ? 'Edit Entry' : KIND_LABEL[kind]}</h3>
          <p>{kind === 'received' ? 'Record money received into the account book.' : 'Record a payment made out (expense).'}</p>
        </div>
        <div style={{ padding: '16px 20px', maxHeight: '58vh', overflowY: 'auto' }}>
          {error && <div className="alert error">{error}</div>}
          <div className="field">
            <label>Category <span className="req">*</span></label>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="" disabled>Select category…</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid2">
            <div className="field">
              <label>Amount (₹) <span className="req">*</span></label>
              <input type="number" min="1" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="field">
              <label>Date <span className="req">*</span></label>
              <input type="date" value={entryDate} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setEntryDate(e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label>Method <span className="opt">(optional)</span></label>
            <input type="text" value={method} placeholder="e.g. Cash, Bank Transfer, UPI" onChange={(e) => setMethod(e.target.value)} />
          </div>
          <div className="field">
            <label>Note <span className="opt">(optional)</span></label>
            <input type="text" value={note} placeholder="e.g. from whom / for what" onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <div className="crop-actions" style={{ flexWrap: 'wrap' }}>
          <button className="btn btn-outline btn-sm" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn btn-green btn-sm" onClick={submit} disabled={busy}>
            {busy ? 'Saving…' : mode === 'edit' ? 'Save Changes' : 'Add Entry'}
          </button>
        </div>
      </div>
    </div>
  );
}
