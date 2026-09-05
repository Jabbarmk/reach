import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { api, exportCsv } from '../api.js';
import LedgerEntryModal from './LedgerEntryModal.jsx';

const LEDGER_COLUMNS = [
  { label: 'Date', value: (r) => new Date(r.entry_date).toLocaleDateString('en-IN') },
  { label: 'Category', value: 'category_name' },
  { label: 'Amount', value: (r) => Number(r.amount) },
  { label: 'Method', value: (r) => r.method || '' },
  { label: 'Note', value: (r) => r.note || '' },
  { label: 'Recorded By', value: 'recorded_by' },
];

const STATEMENT_COLUMNS = [
  { label: 'Date', value: (r) => new Date(r.entry_date).toLocaleDateString('en-IN') },
  { label: 'Type', value: (r) => (r.kind === 'received' ? 'Received' : 'Payment') },
  { label: 'Category', value: 'category_name' },
  { label: 'Note', value: (r) => r.note || '' },
  { label: 'Method', value: (r) => r.method || '' },
  { label: 'Recorded By', value: 'recorded_by' },
  { label: 'Amount', value: (r) => (r.kind === 'received' ? Number(r.amount) : -Number(r.amount)) },
];

const KIND_META = {
  received: { label: 'Received', addLabel: '+ Money Received', emptyText: 'No money received recorded yet.' },
  expense: { label: 'Payments', addLabel: '+ Payment / Expense', emptyText: 'No payments/expenses recorded yet.' },
};

function money(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function LedgerEntriesTab({ kind, isAdmin }) {
  const meta = KIND_META[kind];
  const [rows, setRows] = useState(null);
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null); // { mode, entry }

  const load = async () => {
    setRows(null);
    setError(null);
    try {
      const params = { kind };
      if (categoryId) params.category_id = categoryId;
      if (from) params.from = from;
      if (to) params.to = to;
      if (search) params.search = search;
      setRows(await api.listLedgerEntries(params));
    } catch (err) { setError(err.message); }
  };

  useEffect(() => {
    load();
    (async () => {
      try { setCategories((await api.listLedgerCategories(kind)).categories || []); } catch { /* ignore */ }
    })();
  }, [kind]); // eslint-disable-line react-hooks/exhaustive-deps

  const remove = async (r) => {
    if (!window.confirm(`Delete this ${money(r.amount)} entry?`)) return;
    try { await api.deleteLedgerEntry(r.id); load(); } catch (err) { setError(err.message); }
  };

  const exportEntries = () => exportCsv(`accounts-${kind}-${new Date().toISOString().slice(0, 10)}.csv`, LEDGER_COLUMNS, rows);

  return (
    <>
      {error && <div className="alert error">{error}</div>}
      <div className="toolbar" style={{ flexWrap: 'wrap' }}>
        <input placeholder="Search notes, category, recorded by…" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} />
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} title="From date" />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} title="To date" />
        <button className="btn btn-primary btn-sm" onClick={load}>Search</button>
        <span style={{ flex: 1 }} />
        <button className="btn btn-outline btn-sm" onClick={exportEntries} disabled={!rows?.length}>⬇ Export to Excel</button>
        <button className="btn btn-green btn-sm" onClick={() => setModal({ mode: 'create' })}>{meta.addLabel}</button>
      </div>

      <div className="table-card">
        <div className="table-scroll">
          <table className="apps">
            <thead>
              <tr>
                <th>Date</th><th>Category</th><th>Amount</th><th>Method</th><th>Note</th><th>Recorded By</th>
                {isAdmin && <th style={{ width: 110 }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {rows?.map((r) => (
                <tr key={r.id}>
                  <td>{new Date(r.entry_date).toLocaleDateString('en-IN')}</td>
                  <td>{r.category_name}</td>
                  <td style={{ fontWeight: 700 }}>{money(r.amount)}</td>
                  <td>{r.method || '—'}</td>
                  <td>{r.note || '—'}</td>
                  <td>{r.recorded_by}</td>
                  {isAdmin && (
                    <td style={{ cursor: 'default' }}>
                      <div className="row-actions">
                        <button className="icon-btn" title="Edit" onClick={() => setModal({ mode: 'edit', entry: r })}>✏️</button>
                        <button className="icon-btn danger" title="Delete" onClick={() => remove(r)}>🗑</button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows && rows.length === 0 && <div className="empty-note">{meta.emptyText}</div>}
        {!rows && <div className="empty-note"><span className="spinner lg" /></div>}
      </div>

      {modal && (
        <LedgerEntryModal
          mode={modal.mode} kind={kind} entry={modal.entry}
          onClose={() => setModal(null)}
          onDone={() => { setModal(null); load(); }}
        />
      )}
    </>
  );
}

function LedgerCategoriesTab() {
  const [kind, setKind] = useState('received');
  const [categories, setCategories] = useState(null);
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState(null); // {id, name}
  const [error, setError] = useState(null);

  const load = async () => {
    try { setCategories((await api.listLedgerCategories()).categories); } catch (err) { setError(err.message); }
  };
  useEffect(() => { load(); }, []);

  const entries = categories?.filter((c) => c.kind === kind) || [];

  const add = async () => {
    if (!newName.trim()) return;
    try { await api.createLedgerCategory({ kind, name: newName }); setNewName(''); setError(null); load(); }
    catch (err) { setError(err.message); }
  };
  const saveEdit = async () => {
    try { await api.updateLedgerCategory(editing.id, editing.name); setEditing(null); setError(null); load(); }
    catch (err) { setError(err.message); }
  };
  const remove = async (c) => {
    if (!window.confirm(`Delete the "${c.name}" category? Past entries keep their recorded category name.`)) return;
    try { await api.deleteLedgerCategory(c.id); load(); } catch (err) { setError(err.message); }
  };

  return (
    <>
      {error && <div className="alert error">{error}</div>}
      <div className="tab-row">
        <button className={`tab ${kind === 'received' ? 'active' : ''}`} onClick={() => { setKind('received'); setError(null); }}>Received Types</button>
        <button className={`tab ${kind === 'expense' ? 'active' : ''}`} onClick={() => { setKind('expense'); setError(null); }}>Payment / Expense Types</button>
      </div>
      <div className="card" style={{ maxWidth: 640 }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <input
            style={{ flex: 1, padding: '10px 13px', border: '1.5px solid var(--line)', borderRadius: 10 }}
            placeholder={`Add a new ${kind === 'received' ? 'received' : 'payment/expense'} type…`}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <button className="btn btn-primary btn-sm" onClick={add} disabled={!newName.trim()}>Add</button>
        </div>
        {!categories && <div className="empty-note"><span className="spinner lg" /></div>}
        {entries.map((c) => (
          <div key={c.id} className="opt-row">
            {editing?.id === c.id ? (
              <>
                <input
                  autoFocus value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                  style={{ flex: 1, padding: '7px 11px', border: '1.5px solid var(--blue-600)', borderRadius: 8 }}
                />
                <button className="btn btn-primary btn-sm" onClick={saveEdit}>Save</button>
                <button className="btn btn-outline btn-sm" onClick={() => setEditing(null)}>Cancel</button>
              </>
            ) : (
              <>
                <span style={{ flex: 1 }}>{c.name}</span>
                <button className="btn btn-outline btn-sm" onClick={() => setEditing({ id: c.id, name: c.name })}>Rename</button>
                <button className="btn btn-ghost btn-sm" onClick={() => remove(c)}>Delete</button>
              </>
            )}
          </div>
        ))}
        {categories && !entries.length && <div className="empty-note">No types yet — add the first one above.</div>}
      </div>
    </>
  );
}

// Reports opens showing every entry ever recorded (no date filter) — a date range is
// something the admin opts into afterward, not a default that hides data on first load.
function LedgerReportsTab() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [summary, setSummary] = useState(null);
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState(null);
  const filtered = !!(from || to);

  // Accepts explicit from/to so "Clear filter" can reload with the reset values immediately,
  // instead of racing the setFrom/setTo state updates (which wouldn't be visible yet to a
  // load() call relying on the current closure's from/to).
  const load = async (f = from, t = to) => {
    setError(null);
    try {
      const [s, e] = await Promise.all([
        api.ledgerSummary({ from: f, to: t }),
        api.listLedgerEntries({ from: f, to: t }),
      ]);
      setSummary(s);
      setEntries(e);
    } catch (err) { setError(err.message); }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const clear = () => { setFrom(''); setTo(''); load('', ''); };

  const exportStatement = () => {
    const range = filtered ? `${from || 'start'}_to_${to || 'end'}` : 'all';
    exportCsv(`accounts-statement-${range}.csv`, STATEMENT_COLUMNS, entries);
  };

  return (
    <>
      {error && <div className="alert error">{error}</div>}
      <div className="toolbar" style={{ flexWrap: 'wrap' }}>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} title="From date" />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} title="To date" />
        <button className="btn btn-primary btn-sm" onClick={() => load()}>Update</button>
        {filtered && <button className="btn btn-ghost btn-sm" onClick={clear}>Clear filter — show all</button>}
        <span style={{ flex: 1 }} />
        <button className="btn btn-outline btn-sm" onClick={exportStatement} disabled={!entries?.length}>⬇ Export to Excel</button>
      </div>

      {!summary || !entries ? (
        <div className="empty-note"><span className="spinner lg" /></div>
      ) : (
        <>
          <div className="ovr-grid">
            <div className="ovr-card">
              <div className="ovr-label">Total Received{filtered ? ' (filtered)' : ''}</div>
              <div className="ovr-num" style={{ color: 'var(--green-600)' }}>{money(summary.totals.received)}</div>
            </div>
            <div className="ovr-card">
              <div className="ovr-label">Total Payments{filtered ? ' (filtered)' : ''}</div>
              <div className="ovr-num" style={{ color: 'var(--red-600)' }}>{money(summary.totals.expense)}</div>
            </div>
            <div className="ovr-card">
              <div className="ovr-label">Net{filtered ? ' (filtered)' : ''}</div>
              <div className="ovr-num" style={{ color: summary.totals.net >= 0 ? 'var(--green-600)' : 'var(--red-600)' }}>{money(summary.totals.net)}</div>
            </div>
            <div className="ovr-card">
              <div className="ovr-label">All-Time Balance</div>
              <div className="ovr-num" style={{ color: summary.allTime.balance >= 0 ? 'var(--green-600)' : 'var(--red-600)' }}>{money(summary.allTime.balance)}</div>
            </div>
          </div>

          <div className="table-card">
            <div className="table-scroll">
              <table className="apps statement">
                <thead>
                  <tr><th>Date</th><th>Type</th><th>Category</th><th>Note</th><th>Method</th><th>Recorded By</th><th style={{ textAlign: 'right' }}>Amount</th></tr>
                </thead>
                <tbody>
                  {entries.map((r) => (
                    <tr key={`${r.kind}-${r.id}`}>
                      <td>{new Date(r.entry_date).toLocaleDateString('en-IN')}</td>
                      <td>
                        <span className={`pill ${r.kind === 'received' ? 'green' : 'red'}`}>
                          {r.kind === 'received' ? 'Received' : 'Payment'}
                        </span>
                      </td>
                      <td>{r.category_name}</td>
                      <td>{r.note || '—'}</td>
                      <td>{r.method || '—'}</td>
                      <td>{r.recorded_by}</td>
                      <td className={r.kind === 'received' ? 'stmt-credit' : 'stmt-debit'}>
                        {r.kind === 'received' ? '+ ' : '− '}{money(r.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {entries.length === 0 && <div className="empty-note">No entries{filtered ? ' in this range' : ' yet'}.</div>}
          </div>
        </>
      )}
    </>
  );
}

export default function AccountsPage() {
  const { session } = useOutletContext();
  const isAdmin = session?.role === 'admin';
  const [tab, setTab] = useState('reports');

  return (
    <>
      <div className="ovr-head" style={{ marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 24 }}>Accounts</h1>
          <p>The society's account book — money received, payments made, and reports. Separate from membership fee payments.</p>
        </div>
      </div>

      <div className="tab-row">
        <button className={`tab ${tab === 'reports' ? 'active' : ''}`} onClick={() => setTab('reports')}>Reports</button>
        <button className={`tab ${tab === 'received' ? 'active' : ''}`} onClick={() => setTab('received')}>Received</button>
        <button className={`tab ${tab === 'expense' ? 'active' : ''}`} onClick={() => setTab('expense')}>Payments</button>
        {isAdmin && <button className={`tab ${tab === 'categories' ? 'active' : ''}`} onClick={() => setTab('categories')}>Categories</button>}
      </div>

      {tab === 'reports' && <LedgerReportsTab />}
      {tab === 'received' && <LedgerEntriesTab kind="received" isAdmin={isAdmin} />}
      {tab === 'expense' && <LedgerEntriesTab kind="expense" isAdmin={isAdmin} />}
      {tab === 'categories' && isAdmin && <LedgerCategoriesTab />}
    </>
  );
}
