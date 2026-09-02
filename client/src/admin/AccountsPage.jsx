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

function LedgerReportsTab() {
  const today = new Date();
  const defaultFrom = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const defaultTo = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);

  const load = async () => {
    setError(null);
    try { setSummary(await api.ledgerSummary({ from, to })); } catch (err) { setError(err.message); }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const CategoryTable = ({ title, rows }) => (
    <div className="table-card" style={{ marginBottom: 16 }}>
      <div className="table-scroll">
        <table className="apps">
          <thead><tr><th>{title}</th><th>Entries</th><th>Total</th></tr></thead>
          <tbody>
            {rows?.map((r) => (
              <tr key={r.category_name}>
                <td>{r.category_name}</td>
                <td>{r.count}</td>
                <td style={{ fontWeight: 700 }}>{money(r.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows && rows.length === 0 && <div className="empty-note">No entries in this range.</div>}
    </div>
  );

  return (
    <>
      {error && <div className="alert error">{error}</div>}
      <div className="toolbar" style={{ flexWrap: 'wrap' }}>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} title="From date" />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} title="To date" />
        <button className="btn btn-primary btn-sm" onClick={load}>Update</button>
      </div>

      {!summary ? (
        <div className="empty-note"><span className="spinner lg" /></div>
      ) : (
        <>
          <div className="ovr-grid">
            <div className="ovr-card">
              <div className="ovr-top"><span className="ovr-ico green">✅</span></div>
              <div className="ovr-label">Total Received (range)</div>
              <div className="ovr-num">{money(summary.totals.received)}</div>
            </div>
            <div className="ovr-card">
              <div className="ovr-top"><span className="ovr-ico red">⛔</span></div>
              <div className="ovr-label">Total Payments/Expenses (range)</div>
              <div className="ovr-num">{money(summary.totals.expense)}</div>
            </div>
            <div className="ovr-card">
              <div className="ovr-top"><span className="ovr-ico teal">₹</span></div>
              <div className="ovr-label">Net (range)</div>
              <div className="ovr-num">{money(summary.totals.net)}</div>
            </div>
            <div className="ovr-card">
              <div className="ovr-top"><span className="ovr-ico orange">📒</span></div>
              <div className="ovr-label">All-Time Balance</div>
              <div className="ovr-num">{money(summary.allTime.balance)}</div>
            </div>
          </div>

          <div className="grid2">
            <CategoryTable title="Received by category" rows={summary.byCategory.received} />
            <CategoryTable title="Payments/Expenses by category" rows={summary.byCategory.expense} />
          </div>
        </>
      )}
    </>
  );
}

export default function AccountsPage() {
  const { session } = useOutletContext();
  const isAdmin = session?.role === 'admin';
  const [tab, setTab] = useState('received');

  return (
    <>
      <div className="ovr-head" style={{ marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 24 }}>Accounts</h1>
          <p>The society's account book — money received, payments made, and reports. Separate from membership fee payments.</p>
        </div>
      </div>

      <div className="tab-row">
        <button className={`tab ${tab === 'received' ? 'active' : ''}`} onClick={() => setTab('received')}>Payment Received</button>
        <button className={`tab ${tab === 'expense' ? 'active' : ''}`} onClick={() => setTab('expense')}>Payments</button>
        {isAdmin && <button className={`tab ${tab === 'categories' ? 'active' : ''}`} onClick={() => setTab('categories')}>Categories</button>}
        <button className={`tab ${tab === 'reports' ? 'active' : ''}`} onClick={() => setTab('reports')}>Reports</button>
      </div>

      {tab === 'received' && <LedgerEntriesTab kind="received" isAdmin={isAdmin} />}
      {tab === 'expense' && <LedgerEntriesTab kind="expense" isAdmin={isAdmin} />}
      {tab === 'categories' && isAdmin && <LedgerCategoriesTab />}
      {tab === 'reports' && <LedgerReportsTab />}
    </>
  );
}
