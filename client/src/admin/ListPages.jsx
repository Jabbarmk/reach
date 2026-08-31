import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import { api, fetchDocBlob, setToken } from '../api.js';
import { AppsTable, MemberGrid } from './shared.jsx';
import PaymentModal from './PaymentModal.jsx';

const STATUSES = ['All', 'Pending Verification', 'Payment Verified', 'Approved', 'Active', 'Rejected', 'Correction Requested', 'Payment Pending'];

function useApps(defaultStatus, extraParams = {}) {
  const [params] = useSearchParams();
  const urlSearch = params.get('search') || '';
  const [rows, setRows] = useState(null);
  const [status, setStatus] = useState(defaultStatus);
  const [search, setSearch] = useState(urlSearch);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const extraKey = JSON.stringify(extraParams);

  const load = async (s = status, q = search) => {
    setRows(null);
    setError(null);
    try {
      if (Array.isArray(s)) {
        const lists = await Promise.all(s.map((st) => api.listApplications({ status: st, search: q, ...extraParams })));
        const merged = lists.flat().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        setRows(merged);
      } else {
        setRows(await api.listApplications({ status: s, search: q, ...extraParams }));
      }
    } catch (err) {
      if (err.status === 401) { setToken(null); navigate('/admin/login'); return; }
      setError(err.message);
    }
  };

  useEffect(() => { setSearch(urlSearch); load(status, urlSearch); }, [urlSearch, status, extraKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return { rows, status, setStatus, search, setSearch, error, load };
}

function PageHead({ title, sub, children }) {
  return (
    <div className="ovr-head" style={{ marginBottom: 18 }}>
      <div>
        <h1 style={{ fontSize: 24 }}>{title}</h1>
        <p>{sub}</p>
      </div>
      {children}
    </div>
  );
}

function Toolbar({ ctl, withStatus }) {
  return (
    <div className="toolbar">
      <input
        placeholder="Search by name, reference no or membership ID…"
        value={ctl.search}
        onChange={(e) => ctl.setSearch(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && ctl.load(ctl.status, ctl.search)}
      />
      {withStatus && (
        <select value={ctl.status} onChange={(e) => ctl.setStatus(e.target.value)}>
          {STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
      )}
      <button className="btn btn-primary btn-sm" onClick={() => ctl.load(ctl.status, ctl.search)}>Search</button>
    </div>
  );
}

const EDIT_TEXT_FIELDS = [
  ['name', 'Name'], ['father_name', "Father's Name"], ['house_name', 'House Name'], ['place', 'Place'],
  ['post_office', 'Post Office'], ['aadhaar_number', 'Aadhaar Number'], ['email', 'E-mail'],
  ['whatsapp_number', 'WhatsApp Number'], ['current_job', 'Current Job'], ['years_abroad', 'Years Abroad'],
  ['emergency_name', 'Friend/Family Name'], ['emergency_phone', 'Friend/Family Phone'],
];

function MemberEditModal({ id, onClose, onSaved }) {
  const [app, setApp] = useState(null);
  const [options, setOptions] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [detail, cfg] = await Promise.all([api.getApplication(id), api.formConfig()]);
        setApp(detail.application);
        setOptions(cfg.options || {});
      } catch (err) { setError(err.message); }
    })();
  }, [id]);

  const set = (k, v) => setApp((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const payload = {};
      const keys = [
        'name', 'father_name', 'house_name', 'place', 'post_office', 'panchayath', 'blood_group',
        'date_of_birth', 'aadhaar_number', 'qualification', 'whatsapp_number', 'email', 'current_job',
        'years_abroad', 'emergency_name', 'emergency_phone',
        ...(app.is_expat ? ['phone_abroad', 'home_contact_number', 'id_card_number_abroad', 'working_country', 'city'] : ['retired_year', 'phone_india']),
      ];
      keys.forEach((k) => { payload[k] = app[k] ?? ''; });
      await api.updateApplication(id, payload);
      onSaved();
    } catch (err) { setError(err.message); setBusy(false); }
  };

  return (
    <div className="modal-overlay">
      <div className="crop-modal" style={{ maxWidth: 640 }}>
        <div className="crop-head">
          <h3>Edit Member{app ? ` — ${app.membership_id || app.reference_no}` : ''}</h3>
          <p>Changes are recorded in the member's history.</p>
        </div>
        <div style={{ padding: '16px 20px', maxHeight: '62vh', overflowY: 'auto' }}>
          {error && <div className="alert error">{error}</div>}
          {!app ? <div className="empty-note"><span className="spinner lg" /></div> : (
            <div className="grid2">
              {EDIT_TEXT_FIELDS.map(([key, label]) => (
                <div className="field" key={key}>
                  <label>{label}</label>
                  <input type="text" value={app[key] ?? ''} onChange={(e) => set(key, e.target.value)} />
                </div>
              ))}
              <div className="field">
                <label>Panchayath / Municipality</label>
                <select value={app.panchayath ?? ''} onChange={(e) => set('panchayath', e.target.value)}>
                  <option value="">—</option>
                  {(options.panchayath || []).map((o) => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Blood Group</label>
                <select value={app.blood_group ?? ''} onChange={(e) => set('blood_group', e.target.value)}>
                  <option value="">—</option>
                  {(options.blood_group || []).map((o) => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Qualification</label>
                <select value={app.qualification ?? ''} onChange={(e) => set('qualification', e.target.value)}>
                  <option value="">—</option>
                  {(options.qualification || []).map((o) => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Date of Birth</label>
                <input type="date" value={app.date_of_birth ?? ''} onChange={(e) => set('date_of_birth', e.target.value)} />
              </div>
              {app.is_expat ? (
                <>
                  <div className="field"><label>Phone (Abroad)</label><input type="text" value={app.phone_abroad ?? ''} onChange={(e) => set('phone_abroad', e.target.value)} /></div>
                  <div className="field"><label>Home Contact Number</label><input type="text" value={app.home_contact_number ?? ''} onChange={(e) => set('home_contact_number', e.target.value)} /></div>
                  <div className="field"><label>ID Number (Abroad)</label><input type="text" value={app.id_card_number_abroad ?? ''} onChange={(e) => set('id_card_number_abroad', e.target.value)} /></div>
                  <div className="field">
                    <label>Working Country</label>
                    <select value={app.working_country ?? ''} onChange={(e) => set('working_country', e.target.value)}>
                      <option value="">—</option>
                      {(options.country || []).map((o) => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                  <div className="field"><label>City</label><input type="text" value={app.city ?? ''} onChange={(e) => set('city', e.target.value)} /></div>
                </>
              ) : (
                <>
                  <div className="field"><label>Retired Year</label><input type="number" value={app.retired_year ?? ''} onChange={(e) => set('retired_year', e.target.value)} /></div>
                  <div className="field"><label>Phone (India)</label><input type="text" value={app.phone_india ?? ''} onChange={(e) => set('phone_india', e.target.value)} /></div>
                </>
              )}
            </div>
          )}
        </div>
        <div className="crop-actions">
          <button className="btn btn-outline btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={save} disabled={busy || !app}>
            {busy ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

function usePersisted(key, initial) {
  const [value, setValue] = useState(() => {
    try { return localStorage.getItem(key) || initial; } catch { return initial; }
  });
  useEffect(() => { try { localStorage.setItem(key, value); } catch { /* ignore */ } }, [key, value]);
  return [value, setValue];
}

function MembersSummary({ stats }) {
  if (!stats) return null;
  const count = (name) => stats.byStatus.find((r) => r.status === name)?.count || 0;
  const items = [
    { label: 'Total', value: stats.total, tone: '' },
    { label: 'Active', value: count('Active'), tone: 'green' },
    { label: 'Pending', value: stats.pending, tone: 'orange' },
    { label: 'Awaiting Approval', value: count('Payment Verified'), tone: 'blue' },
  ];
  return (
    <div className="mini-stats">
      {items.map((it) => (
        <div key={it.label} className={`mini-stat ${it.tone}`}>
          <span className="n">{it.value ?? '–'}</span>
          <span className="l">{it.label}</span>
        </div>
      ))}
    </div>
  );
}

export function MembersPage() {
  const { session, refreshStats, stats } = useOutletContext();
  const isAdmin = session?.role === 'admin';
  const [tab, setTab] = useState('members');
  const ctl = useApps('All', tab === 'deleted' ? { deleted: '1' } : {});
  const [editId, setEditId] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [view, setView] = usePersisted('reach_members_view', 'table');
  const [cardSize, setCardSize] = usePersisted('reach_members_card_size', 'default');
  const [photoUrls, setPhotoUrls] = useState({});

  const run = async (fn) => {
    setActionError(null);
    try { await fn(); ctl.load(); refreshStats?.(); }
    catch (err) { setActionError(err.message); }
  };

  // Card grid shows real photo thumbnails; fetched only in grid view to avoid the extra
  // authenticated requests when the table (which doesn't need them) is active.
  useEffect(() => {
    if (view !== 'grid' || !ctl.rows) return;
    let cancelled = false;
    const created = [];
    (async () => {
      const entries = await Promise.all(
        ctl.rows.filter((r) => r.photo_doc_id).map(async (r) => {
          try { const url = await fetchDocBlob(r.photo_doc_id); created.push(url); return [r.id, url]; }
          catch { return null; }
        })
      );
      if (cancelled) { created.forEach((u) => URL.revokeObjectURL(u)); return; }
      setPhotoUrls(Object.fromEntries(entries.filter(Boolean)));
    })();
    return () => { cancelled = true; created.forEach((u) => URL.revokeObjectURL(u)); };
  }, [view, ctl.rows]);

  const doEdit = (r) => setEditId(r.id);
  const doDeactivate = (r) => window.confirm(`Deactivate ${r.name}?`) && run(() => api.action(r.id, 'deactivate'));
  const doReactivate = (r) => run(() => api.action(r.id, 'reactivate'));
  const doDelete = (r) => window.confirm(`Delete ${r.name}? The member will move to Deleted Members and can be restored.`) && run(() => api.deleteApplication(r.id));
  const doRestore = (r) => run(() => api.restoreApplication(r.id));
  const doPurge = (r) => {
    const check = window.prompt(`Type DELETE to permanently remove ${r.name} and all documents:`);
    if (check === 'DELETE') run(() => api.purgeApplication(r.id));
  };

  const memberActions = (r) => (
    <div className="row-actions">
      <button className="icon-btn" title="Edit member" onClick={() => doEdit(r)}>✏️</button>
      {r.status === 'Active' && <button className="icon-btn" title="Deactivate member" onClick={() => doDeactivate(r)}>🚫</button>}
      {r.status === 'Deactivated' && <button className="icon-btn" title="Reactivate member" onClick={() => doReactivate(r)}>✅</button>}
      <button className="icon-btn danger" title="Delete (moves to Deleted Members)" onClick={() => doDelete(r)}>🗑</button>
    </div>
  );
  const deletedActions = (r) => (
    <div className="row-actions">
      <button className="icon-btn" title="Restore member" onClick={() => doRestore(r)}>♻️</button>
      <button className="icon-btn danger" title="Delete permanently" onClick={() => doPurge(r)}>🗑</button>
    </div>
  );

  const memberMenuItems = (r) => {
    const items = [{ icon: '✏️', label: 'Edit', onClick: () => doEdit(r) }];
    if (r.status === 'Active') items.push({ icon: '🚫', label: 'Deactivate', onClick: () => doDeactivate(r) });
    if (r.status === 'Deactivated') items.push({ icon: '✅', label: 'Reactivate', onClick: () => doReactivate(r) });
    items.push({ icon: '🗑', label: 'Delete', onClick: () => doDelete(r), danger: true });
    return items;
  };
  const deletedMenuItems = (r) => [
    { icon: '♻️', label: 'Restore', onClick: () => doRestore(r) },
    { icon: '🗑', label: 'Delete permanently', onClick: () => doPurge(r), danger: true },
  ];

  const deletedEmptyText = 'No deleted members — the recycle bin is empty.';

  return (
    <>
      <PageHead title="Members" sub="All membership applications and registered members.">
        <MembersSummary stats={stats} />
      </PageHead>
      {isAdmin && (
        <div className="tab-row">
          <button className={`tab ${tab === 'members' ? 'active' : ''}`} onClick={() => setTab('members')}>Members</button>
          <button className={`tab ${tab === 'deleted' ? 'active' : ''}`} onClick={() => setTab('deleted')}>Deleted Members</button>
        </div>
      )}
      {(ctl.error || actionError) && <div className="alert error">{ctl.error || actionError}</div>}

      <div className="view-toolbar">
        <div className="seg" role="group" aria-label="View">
          <button className={`seg-btn ${view === 'table' ? 'active' : ''}`} onClick={() => setView('table')}>☰ Table</button>
          <button className={`seg-btn ${view === 'grid' ? 'active' : ''}`} onClick={() => setView('grid')}>▦ Grid</button>
        </div>
        {view === 'grid' && (
          <div className="seg" role="group" aria-label="Card size">
            <button className={`seg-btn ${cardSize === 'default' ? 'active' : ''}`} onClick={() => setCardSize('default')}>Default</button>
            <button className={`seg-btn ${cardSize === 'compact' ? 'active' : ''}`} onClick={() => setCardSize('compact')}>Compact</button>
          </div>
        )}
      </div>

      {tab === 'members' ? (
        <>
          <Toolbar ctl={ctl} withStatus />
          {view === 'table'
            ? <AppsTable rows={ctl.rows} renderActions={isAdmin ? memberActions : undefined} />
            : <MemberGrid rows={ctl.rows} size={cardSize} photoUrls={photoUrls} menuItems={isAdmin ? memberMenuItems : undefined} />}
        </>
      ) : (
        <>
          <Toolbar ctl={ctl} />
          {view === 'table'
            ? <AppsTable rows={ctl.rows} emptyText={deletedEmptyText} renderActions={deletedActions} />
            : <MemberGrid rows={ctl.rows} size={cardSize} photoUrls={photoUrls} menuItems={deletedMenuItems} emptyText={deletedEmptyText} />}
        </>
      )}
      {editId && (
        <MemberEditModal id={editId} onClose={() => setEditId(null)} onSaved={() => { setEditId(null); ctl.load(); }} />
      )}
    </>
  );
}

export function ApprovalsPage() {
  const ctl = useApps(['Payment Verified', 'Pending Verification', 'Submitted', 'Correction Requested']);
  return (
    <>
      <PageHead title="Approvals" sub="Applications with payment verified and ready for approval, plus anything still awaiting payment." />
      {ctl.error && <div className="alert error">{ctl.error}</div>}
      <Toolbar ctl={ctl} />
      <AppsTable rows={ctl.rows} emptyText="Nothing pending — all applications have been processed. 🎉" />
    </>
  );
}

function PaymentsSummary({ rows }) {
  if (!rows) return null;
  const total = rows.reduce((s, p) => s + Number(p.amount), 0);
  const now = new Date();
  const thisMonth = rows
    .filter((p) => { const d = new Date(p.paid_on); return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth(); })
    .reduce((s, p) => s + Number(p.amount), 0);
  const avg = rows.length ? total / rows.length : 0;
  const items = [
    { label: 'Total Collected', value: `₹${total.toLocaleString('en-IN')}`, tone: '' },
    { label: 'Payments', value: rows.length, tone: 'blue' },
    { label: 'This Month', value: `₹${thisMonth.toLocaleString('en-IN')}`, tone: 'green' },
    { label: 'Avg. Payment', value: `₹${Math.round(avg).toLocaleString('en-IN')}`, tone: 'orange' },
  ];
  return (
    <div className="mini-stats" style={{ marginBottom: 16 }}>
      {items.map((it) => (
        <div key={it.label} className={`mini-stat ${it.tone}`}>
          <span className="n">{it.value}</span>
          <span className="l">{it.label}</span>
        </div>
      ))}
    </div>
  );
}

function ReceivedPaymentsTab({ isAdmin }) {
  const [rows, setRows] = useState(null);
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [collectedByFilter, setCollectedByFilter] = useState('');
  const [recordedByFilter, setRecordedByFilter] = useState('');
  const [methods, setMethods] = useState([]);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState(null);
  const [editPayment, setEditPayment] = useState(null);
  const navigate = useNavigate();

  const filters = () => ({
    ...(search ? { search } : {}),
    ...(methodFilter ? { method: methodFilter } : {}),
    ...(collectedByFilter ? { collected_by: collectedByFilter } : {}),
    ...(recordedByFilter ? { recorded_by: recordedByFilter } : {}),
  });

  const load = async () => {
    setError(null);
    try { setRows(await api.listPayments(filters())); }
    catch (err) {
      if (err.status === 401) { setToken(null); navigate('/admin/login'); return; }
      setError(err.message);
    }
  };
  useEffect(() => {
    (async () => {
      try {
        const [cfg, collectors] = await Promise.all([api.formConfig(), api.listCollectors()]);
        setMethods(cfg.options?.payment_method || []);
        setUsers(collectors || []);
      } catch { /* filters just stay empty */ }
    })();
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [methodFilter, collectedByFilter, recordedByFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const userName = (username) => users.find((u) => u.username === username)?.name || username;
  const userLabel = (username) => {
    const u = users.find((x) => x.username === username);
    return u ? `${u.name} — ${u.roleLabel}` : username;
  };

  const viewReceipt = async (p) => {
    try {
      const url = await fetchDocBlob(p.receipt_doc_id);
      window.open(url, '_blank');
    } catch (err) { setError(err.message); }
  };

  const remove = async (p) => {
    if (!window.confirm(`Delete the ₹${Number(p.amount).toLocaleString('en-IN')} payment of ${p.name}? The member becomes Unpaid again.`)) return;
    try { await api.deletePayment(p.id); load(); } catch (err) { setError(err.message); }
  };

  const clearFilters = () => { setSearch(''); setMethodFilter(''); setCollectedByFilter(''); setRecordedByFilter(''); };
  const filtersActive = methodFilter || collectedByFilter || recordedByFilter;

  return (
    <>
      {error && <div className="alert error">{error}</div>}
      <PaymentsSummary rows={rows} />
      <div className="toolbar">
        <input
          placeholder="Search by name, reference no, membership ID or receipt no…"
          value={search} onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()}
        />
        <select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)}>
          <option value="">All Methods</option>
          {methods.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={collectedByFilter} onChange={(e) => setCollectedByFilter(e.target.value)}>
          <option value="">Collected By: Anyone</option>
          {users.map((u) => <option key={u.username} value={u.username}>{u.name} — {u.roleLabel}</option>)}
        </select>
        <select value={recordedByFilter} onChange={(e) => setRecordedByFilter(e.target.value)}>
          <option value="">Recorded By: Anyone</option>
          {users.map((u) => <option key={u.username} value={u.username}>{u.name}</option>)}
        </select>
        <button className="btn btn-primary btn-sm" onClick={() => load()}>Search</button>
        {filtersActive && <button className="btn btn-ghost btn-sm" onClick={clearFilters}>Clear filters</button>}
      </div>
      <div className="table-card">
        <div className="table-scroll">
          <table className="apps">
            <thead>
              <tr>
                <th>Member</th><th>Membership ID</th><th>Amount</th><th>Method</th>
                <th>Collected By</th><th>Date</th><th>Recorded By</th><th>Receipt</th>
                {isAdmin && <th style={{ width: 120 }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {rows?.map((p) => (
                <tr key={p.id} onClick={() => navigate(`/admin/applications/${p.application_id}`)}>
                  <td style={{ fontWeight: 600 }}>{p.name}</td>
                  <td style={{ color: 'var(--blue-800)', fontWeight: 700 }}>{p.membership_id || p.reference_no}</td>
                  <td style={{ fontWeight: 700 }}>₹{Number(p.amount).toLocaleString('en-IN')}</td>
                  <td>{p.method}</td>
                  <td>{p.collected_by ? userLabel(p.collected_by) : '—'}</td>
                  <td>{p.paid_on}</td>
                  <td>{userName(p.recorded_by)}</td>
                  <td onClick={(e) => e.stopPropagation()} style={{ cursor: 'default' }}>
                    {p.receipt_doc_id
                      ? <button className="btn btn-outline btn-sm" onClick={() => viewReceipt(p)}>📄 View</button>
                      : <span className="pill grey">None</span>}
                  </td>
                  {isAdmin && (
                    <td onClick={(e) => e.stopPropagation()} style={{ cursor: 'default' }}>
                      <div className="row-actions">
                        <button className="icon-btn" title="Edit payment" onClick={() => setEditPayment(p)}>✏️</button>
                        <button className="icon-btn danger" title="Delete payment" onClick={() => remove(p)}>🗑</button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows && rows.length === 0 && <div className="empty-note">{filtersActive || search ? 'No payments match these filters.' : 'No payments recorded yet.'}</div>}
        {!rows && !error && <div className="empty-note"><span className="spinner lg" /></div>}
      </div>
      {editPayment && (
        <PaymentModal
          mode="edit"
          app={{ id: editPayment.application_id, name: editPayment.name, membership_id: editPayment.membership_id, membership_type: editPayment.membership_type, membership_fee: editPayment.amount }}
          payment={editPayment}
          onClose={() => setEditPayment(null)}
          onDone={() => { setEditPayment(null); load(); }}
        />
      )}
    </>
  );
}

export function PaymentsPage() {
  const { session, refreshStats } = useOutletContext();
  const isAdmin = session?.role === 'admin';
  const [tab, setTab] = useState('received');
  const ctl = useApps(['Pending Verification', 'Submitted']);
  const [recordFor, setRecordFor] = useState(null);

  const dueActions = (r) => (
    <button className="btn btn-teal btn-sm" onClick={() => setRecordFor(r)}>₹ Record</button>
  );

  return (
    <>
      <PageHead title="Payments" sub="Applications awaiting payment verification, and the payment records received." />
      <div className="tab-row">
        <button className={`tab ${tab === 'due' ? 'active' : ''}`} onClick={() => setTab('due')}>Payment due</button>
        <button className={`tab ${tab === 'received' ? 'active' : ''}`} onClick={() => setTab('received')}>Received</button>
      </div>
      {tab === 'due' ? (
        <>
          {ctl.error && <div className="alert error">{ctl.error}</div>}
          <Toolbar ctl={ctl} />
          <AppsTable rows={ctl.rows} emptyText="No payments due." renderActions={dueActions} />
        </>
      ) : (
        <ReceivedPaymentsTab isAdmin={isAdmin} />
      )}
      {recordFor && (
        <PaymentModal
          mode="record"
          app={recordFor}
          onClose={() => setRecordFor(null)}
          onDone={() => { setRecordFor(null); ctl.load(); refreshStats?.(); }}
        />
      )}
    </>
  );
}

export function EventsPage() {
  return (
    <>
      <PageHead title="Events" sub="Community events and programmes." />
      <div className="card" style={{ textAlign: 'center', padding: 48 }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>📅</div>
        <h2 style={{ fontSize: 18 }}>Events module coming soon</h2>
        <p className="sub" style={{ marginBottom: 0 }}>
          This section is reserved for society events and announcements. It is not part of the current
          membership registration phase.
        </p>
      </div>
    </>
  );
}

