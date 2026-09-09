import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, downloadAuthedFile, setToken } from '../api.js';
import { formatDate } from '../dateUtils.js';
import { statusPill } from './shared.jsx';

const EMPTY = { from: '', to: '', status: '', plan: '', country: '', panchayath: '', expat: '', payment: '' };
const clean = (f) => Object.fromEntries(Object.entries(f).filter(([, v]) => v !== '' && v !== null && v !== undefined));
const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const num = (n) => Number(n || 0).toLocaleString('en-IN');
const stamp = () => new Date().toISOString().slice(0, 10);

const TABS = [
  ['overview', 'Overview'],
  ['country', 'By Country'],
  ['panchayath', 'By Panchayath / Municipality'],
  ['members', 'Members'],
];

function SummaryCards({ s, filtered }) {
  const suffix = filtered ? ' (filtered)' : '';
  const cards = [
    { label: `Registrations${suffix}`, value: num(s.registrations), ico: '📝', tone: 'blue' },
    { label: 'Active members', value: num(s.active), ico: '✅', tone: 'green' },
    { label: 'Members paid', value: `${num(s.paid_count)} / ${num(s.registrations)}`, ico: '🧾', tone: 'teal' },
    { label: 'Fees collected', value: money(s.collected), ico: '₹', tone: 'green' },
    { label: 'Outstanding', value: money(s.outstanding), ico: '⏳', tone: 'orange' },
    { label: 'Expected fees', value: money(s.expected_fees), ico: '🎯', tone: 'blue' },
  ];
  return (
    <div className="ovr-grid rep-grid">
      {cards.map((c) => (
        <div key={c.label} className="ovr-card">
          <div className="ovr-top"><span className={`ovr-ico ${c.tone}`}>{c.ico}</span></div>
          <div className="ovr-label">{c.label}</div>
          <div className="ovr-num rep-num">{c.value}</div>
        </div>
      ))}
    </div>
  );
}

// Compact bar list used on the Overview tab (top N groups by registrations).
function BarCard({ title, rows, labelKey, onPick, limit = 8, empty }) {
  const top = rows.slice(0, limit);
  const max = top[0]?.registrations || 1;
  return (
    <div className="ovr-country-card rep-bar-card">
      <h2>{title}</h2>
      {top.length === 0 ? <div className="empty-note" style={{ padding: 18 }}>{empty}</div> : (
        <div className="ovr-country-list">
          {top.map((r) => (
            <div className="ovr-country-row rep-bar-row" key={r[labelKey]} onClick={() => onPick(r[labelKey])} title="Click to filter the report by this group">
              <span className="ovr-country-name">{r[labelKey]}</span>
              <div className="ovr-country-bar"><div className="ovr-country-fill" style={{ width: `${(r.registrations / max) * 100}%` }} /></div>
              <span className="ovr-country-count">{num(r.registrations)}</span>
              <span className="rep-bar-money">{money(r.collected)}</span>
            </div>
          ))}
        </div>
      )}
      {rows.length > limit && <div className="rep-more">+ {rows.length - limit} more — see the full table</div>}
    </div>
  );
}

function GroupTable({ rows, labelKey, labelHead, totals, onPick, empty }) {
  return (
    <div className="table-card">
      <div className="table-scroll">
        <table className="apps rep-table">
          <thead>
            <tr>
              <th>{labelHead}</th>
              <th className="r">Registrations</th>
              <th className="r">Active</th>
              <th className="r">Pending</th>
              <th className="r">Expats</th>
              <th className="r">Paid</th>
              <th className="r">Unpaid</th>
              <th className="r">Expected fees</th>
              <th className="r">Collected</th>
              <th className="r">Outstanding</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r[labelKey]} onClick={() => onPick(r[labelKey])} title="Click to filter the member list by this group">
                <td style={{ fontWeight: 700, color: 'var(--blue-800)' }}>{r[labelKey]}</td>
                <td className="r">{num(r.registrations)}</td>
                <td className="r">{num(r.active)}</td>
                <td className="r">{num(r.pending)}</td>
                <td className="r">{num(r.expats)}</td>
                <td className="r">{num(r.paid_count)}</td>
                <td className="r">{num(r.unpaid_count)}</td>
                <td className="r">{money(r.expected_fees)}</td>
                <td className="r money-in">{money(r.collected)}</td>
                <td className="r money-out">{money(r.outstanding)}</td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr>
                <td>Total</td>
                <td className="r">{num(totals.registrations)}</td>
                <td className="r">{num(totals.active)}</td>
                <td className="r">{num(totals.pending)}</td>
                <td className="r">{num(totals.expats)}</td>
                <td className="r">{num(totals.paid_count)}</td>
                <td className="r">{num(totals.unpaid_count)}</td>
                <td className="r">{money(totals.expected_fees)}</td>
                <td className="r money-in">{money(totals.collected)}</td>
                <td className="r money-out">{money(totals.outstanding)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {rows.length === 0 && <div className="empty-note">{empty}</div>}
    </div>
  );
}

function MembersTable({ rows, unrecorded }) {
  const navigate = useNavigate();
  return (
    <div className="table-card">
      {unrecorded > 0 && (
        <div className="rep-note">* {unrecorded} member{unrecorded === 1 ? ' is' : 's are'} marked Paid without a payment record — the full plan fee is assumed as received.</div>
      )}
      <div className="table-scroll">
        <table className="apps rep-table">
          <thead>
            <tr>
              <th>#</th><th>Reference / ID</th><th>Name</th><th>Panchayath</th><th>Country</th><th>Plan</th>
              <th>Status</th><th>Payment</th><th className="r">Paid</th><th className="r">Balance</th><th>Paid on</th><th>Registered</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m, i) => (
              <tr key={m.id} onClick={() => navigate(`/admin/applications/${m.id}`)}>
                <td style={{ color: 'var(--muted)' }}>{i + 1}</td>
                <td style={{ fontWeight: 700, color: 'var(--blue-800)', fontSize: 12 }}>{m.membership_id || m.reference_no}</td>
                <td>{m.name}</td>
                <td>{m.panchayath}</td>
                <td>{m.country}</td>
                <td>{m.plan_name}</td>
                <td>{statusPill(m.status)}</td>
                <td>{m.payment_status === 'Paid' ? <span className="pill green">Paid</span> : <span className="pill grey">Unpaid</span>}</td>
                <td className="r money-in">{m.paid_amount === null ? '—' : money(m.paid_amount)}{m.paid_amount !== null && !m.payment_recorded && <span title="Marked Paid without a payment record — full fee assumed"> *</span>}</td>
                <td className={`r ${m.balance > 0 ? 'money-out' : ''}`}>{m.balance > 0 ? money(m.balance) : '—'}</td>
                <td>{m.paid_on ? formatDate(m.paid_on) : '—'}</td>
                <td>{new Date(m.created_at).toLocaleDateString('en-IN')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && <div className="empty-note">No members match the selected filters.</div>}
    </div>
  );
}

export default function ReportsPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);      // filter inputs being edited
  const [applied, setApplied] = useState(EMPTY); // filters the current report was built with
  const [data, setData] = useState(null);
  const [options, setOptions] = useState(null);
  const [tab, setTab] = useState('overview');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = async (f = form) => {
    setError(null);
    setData(null);
    setApplied(f);
    try {
      const r = await api.registrationReport(clean(f));
      setData(r);
      // Option lists are unfiltered, so the first response is enough to populate the selects.
      setOptions((o) => o || r.options);
    } catch (err) {
      if (err.status === 401) { setToken(null); navigate('/admin/login'); return; }
      setError(err.message);
    }
  };
  useEffect(() => { load(EMPTY); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const filtered = Object.keys(clean(applied)).length > 0;
  const dirty = JSON.stringify(form) !== JSON.stringify(applied);
  const clear = () => { setForm(EMPTY); load(EMPTY); };

  // Drill-down from a breakdown row: apply that group as a filter and jump to the member list.
  const pick = (key) => (value) => {
    const next = { ...applied, [key]: applied[key] === value ? '' : value };
    setForm(next);
    setTab('members');
    load(next);
  };

  const exportAs = async (format) => {
    setBusy(format);
    setError(null);
    try {
      await downloadAuthedFile(api.reportExportUrl(format, clean(applied)), `registration-report-${stamp()}.${format}`);
    } catch (err) { setError(err.message); }
    finally { setBusy(null); }
  };

  return (
    <>
      <div className="ovr-head" style={{ marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 24 }}>Reports</h1>
          <p>Registration and membership-fee summary by country and Panchayath/Municipality. Filter, then export the report to Excel or PDF.</p>
        </div>
        <div className="rep-actions">
          <button className="btn btn-outline btn-sm" onClick={() => exportAs('xlsx')} disabled={!data || !!busy}>
            {busy === 'xlsx' ? <span className="spinner" /> : '⬇'} Export to Excel
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => exportAs('pdf')} disabled={!data || !!busy}>
            {busy === 'pdf' ? <span className="spinner" /> : '⬇'} Download PDF
          </button>
        </div>
      </div>

      {error && <div className="alert error">{error}</div>}

      <div className="rep-filters">
        <div className="rep-filter">
          <label>Registered from</label>
          <input type="date" value={form.from} onChange={(e) => set('from', e.target.value)} />
        </div>
        <div className="rep-filter">
          <label>Registered to</label>
          <input type="date" value={form.to} onChange={(e) => set('to', e.target.value)} />
        </div>
        <div className="rep-filter">
          <label>Country</label>
          <select value={form.country} onChange={(e) => set('country', e.target.value)}>
            <option value="">All countries</option>
            {(options?.countries || []).map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="rep-filter">
          <label>Panchayath / Municipality</label>
          <select value={form.panchayath} onChange={(e) => set('panchayath', e.target.value)}>
            <option value="">All Panchayaths/Municipalities</option>
            {(options?.panchayaths || []).map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="rep-filter">
          <label>Status</label>
          <select value={form.status} onChange={(e) => set('status', e.target.value)}>
            <option value="">All statuses</option>
            {(options?.statuses || []).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="rep-filter">
          <label>Membership plan</label>
          <select value={form.plan} onChange={(e) => set('plan', e.target.value)}>
            <option value="">All plans</option>
            {(options?.plans || []).map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
          </select>
        </div>
        <div className="rep-filter">
          <label>Expat</label>
          <select value={form.expat} onChange={(e) => set('expat', e.target.value)}>
            <option value="">All members</option>
            <option value="1">Expats only</option>
            <option value="0">Non-expats only</option>
          </select>
        </div>
        <div className="rep-filter">
          <label>Payment</label>
          <select value={form.payment} onChange={(e) => set('payment', e.target.value)}>
            <option value="">Paid & unpaid</option>
            <option value="Paid">Paid</option>
            <option value="Unpaid">Unpaid</option>
          </select>
        </div>
        <div className="rep-filter-actions">
          <button className="btn btn-primary btn-sm" onClick={() => load(form)} disabled={!dirty && !!data}>Apply filters</button>
          {(filtered || dirty) && <button className="btn btn-ghost btn-sm" onClick={clear}>Clear</button>}
        </div>
      </div>

      {!data ? <div className="empty-note"><span className="spinner lg" /></div> : (
        <>
          <div className="rep-meta">
            <span className={`pill ${filtered ? 'teal' : 'grey'}`}>{filtered ? 'Filtered' : 'All data'}</span>
            <span className="rep-meta-text">{data.filter_text}</span>
            <span style={{ flex: 1 }} />
            {data.summary.unrecorded_paid > 0 && (
              <span className="rep-meta-text" title="These members were marked Paid before payment records existed; the full plan fee is counted as received.">
                ⓘ {data.summary.unrecorded_paid} paid without a payment record
              </span>
            )}
            <span className="rep-meta-text">Generated {new Date(data.generated_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
          </div>

          <SummaryCards s={data.summary} filtered={filtered} />

          <div className="tab-row" style={{ flexWrap: 'wrap' }}>
            {TABS.map(([key, label]) => (
              <button key={key} className={`tab ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>
                {label}
                {key === 'country' && <span className="tab-count">{data.byCountry.length}</span>}
                {key === 'panchayath' && <span className="tab-count">{data.byPanchayath.length}</span>}
                {key === 'members' && <span className="tab-count">{data.members.length}</span>}
              </button>
            ))}
          </div>

          {tab === 'overview' && (
            <>
              <div className="rep-two-col">
                <BarCard title="Registrations by Country" rows={data.byCountry} labelKey="country" onPick={pick('country')} empty="No registrations match the filters." />
                <BarCard title="Registrations by Panchayath / Municipality" rows={data.byPanchayath} labelKey="panchayath" onPick={pick('panchayath')} empty="No registrations match the filters." />
              </div>
              <div className="rep-two-col">
                <div className="table-card">
                  <div className="rep-card-title">By Membership Plan</div>
                  <div className="table-scroll">
                    <table className="apps rep-table static">
                      <thead><tr><th>Plan</th><th className="r">Registrations</th><th className="r">Paid</th><th className="r">Collected</th><th className="r">Outstanding</th></tr></thead>
                      <tbody>
                        {data.byPlan.map((p) => (
                          <tr key={p.plan_code}>
                            <td style={{ fontWeight: 600 }}>{p.plan_name}</td>
                            <td className="r">{num(p.registrations)}</td>
                            <td className="r">{num(p.paid_count)}</td>
                            <td className="r money-in">{money(p.collected)}</td>
                            <td className="r money-out">{money(p.outstanding)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {data.byPlan.length === 0 && <div className="empty-note">No data.</div>}
                </div>
                <div className="table-card">
                  <div className="rep-card-title">By Status</div>
                  <div className="table-scroll">
                    <table className="apps rep-table static">
                      <thead><tr><th>Status</th><th className="r">Registrations</th><th className="r">Collected</th></tr></thead>
                      <tbody>
                        {data.byStatus.map((s) => (
                          <tr key={s.status}>
                            <td>{statusPill(s.status)}</td>
                            <td className="r">{num(s.count)}</td>
                            <td className="r money-in">{money(s.collected)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {data.byStatus.length === 0 && <div className="empty-note">No data.</div>}
                </div>
              </div>
            </>
          )}

          {tab === 'country' && (
            <GroupTable rows={data.byCountry} labelKey="country" labelHead="Country" totals={data.summary} onPick={pick('country')} empty="No registrations match the selected filters." />
          )}
          {tab === 'panchayath' && (
            <GroupTable rows={data.byPanchayath} labelKey="panchayath" labelHead="Panchayath / Municipality" totals={data.summary} onPick={pick('panchayath')} empty="No registrations match the selected filters." />
          )}
          {tab === 'members' && <MembersTable rows={data.members} unrecorded={data.summary.unrecorded_paid} />}
        </>
      )}
    </>
  );
}
