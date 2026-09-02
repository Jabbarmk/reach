import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, fetchReceiptBlob, downloadBlob, setToken, exportCsv } from '../api.js';

const RECEIPT_COLUMNS = [
  { label: 'Receipt No.', value: 'receipt_number' },
  { label: 'Member', value: 'name' },
  { label: 'Membership ID', value: (r) => r.membership_id || '' },
  { label: 'Plan', value: (r) => (r.membership_type === 'lifetime' ? 'Lifetime' : 'Two-Year') },
  { label: 'Amount', value: (r) => Number(r.amount) },
  { label: 'Method', value: 'method' },
  { label: 'Date', value: 'paid_on' },
  { label: 'Recorded By', value: 'recorded_by' },
];

export default function ReceiptsPage() {
  const [rows, setRows] = useState(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const navigate = useNavigate();

  const load = async (q = search) => {
    setError(null);
    try { setRows(await api.listReceipts(q ? { search: q } : {})); }
    catch (err) {
      if (err.status === 401) { setToken(null); navigate('/admin/login'); return; }
      setError(err.message);
    }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const view = async (r) => {
    setBusyId(r.id);
    try {
      const url = await fetchReceiptBlob(r.id);
      window.open(url, '_blank');
    } catch (err) { setError(err.message); }
    finally { setBusyId(null); }
  };

  const download = async (r) => {
    setBusyId(r.id);
    try {
      const url = await fetchReceiptBlob(r.id);
      downloadBlob(url, `${r.receipt_number}.pdf`);
    } catch (err) { setError(err.message); }
    finally { setBusyId(null); }
  };

  const exportReceipts = () => exportCsv(`receipts-${new Date().toISOString().slice(0, 10)}.csv`, RECEIPT_COLUMNS, rows);

  return (
    <>
      <div className="ovr-head" style={{ marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 24 }}>Receipts</h1>
          <p>Every payment receipt, auto-generated and e-mailed to the member when payment is recorded.</p>
        </div>
      </div>

      {error && <div className="alert error">{error}</div>}

      <div className="toolbar">
        <input
          placeholder="Search by receipt number, name, reference no or membership ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()}
        />
        <button className="btn btn-primary btn-sm" onClick={() => load()}>Search</button>
        <span style={{ flex: 1 }} />
        <button className="btn btn-outline btn-sm" onClick={exportReceipts} disabled={!rows?.length}>⬇ Export to Excel</button>
      </div>

      <div className="table-card">
        <div className="table-scroll">
          <table className="apps">
            <thead>
              <tr>
                <th>Receipt No.</th><th>Member</th><th>Membership ID</th><th>Plan</th>
                <th>Amount</th><th>Method</th><th>Date</th><th>Recorded By</th>
                <th style={{ width: 170 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows?.map((r) => (
                <tr key={r.id} onClick={() => navigate(`/admin/applications/${r.application_id}`)}>
                  <td style={{ fontWeight: 700, color: 'var(--blue-800)', fontFamily: 'monospace' }}>{r.receipt_number}</td>
                  <td>{r.name}</td>
                  <td>{r.membership_id || '—'}</td>
                  <td>{r.membership_type === 'lifetime' ? 'Lifetime' : 'Two-Year'}</td>
                  <td style={{ fontWeight: 700 }}>₹{Number(r.amount).toLocaleString('en-IN')}</td>
                  <td>{r.method}</td>
                  <td>{r.paid_on}</td>
                  <td>{r.recorded_by}</td>
                  <td onClick={(e) => e.stopPropagation()} style={{ cursor: 'default' }}>
                    <div className="row-actions">
                      <button className="btn btn-outline btn-sm" disabled={busyId === r.id} onClick={() => view(r)}>👁 View</button>
                      <button className="btn btn-teal btn-sm" disabled={busyId === r.id} onClick={() => download(r)}>⬇ Download</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows && rows.length === 0 && <div className="empty-note">No receipts yet — they're generated automatically whenever a payment is recorded.</div>}
        {!rows && !error && <div className="empty-note"><span className="spinner lg" /></div>}
      </div>
    </>
  );
}
