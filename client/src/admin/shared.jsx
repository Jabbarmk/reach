import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export const statusPill = (s) => {
  const map = {
    'Pending Verification': 'orange', 'Correction Requested': 'red', 'Payment Pending': 'blue',
    Active: 'green', Approved: 'teal', Rejected: 'red', Submitted: 'grey', Expired: 'grey',
    Deactivated: 'red',
  };
  return <span className={`pill ${map[s] || 'grey'}`}>{s}</span>;
};

export function AppsTable({ rows, emptyText = 'No applications found.', renderActions }) {
  const navigate = useNavigate();
  return (
    <div className="table-card">
      <div className="table-scroll">
        <table className="apps">
          <thead>
            <tr>
              <th>Reference</th><th>Name</th><th>Place</th><th>Plan</th>
              <th>Expat</th><th>Aadhaar</th><th>Status</th><th>Payment</th><th>Submitted</th>
              {renderActions && <th style={{ width: 130 }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {rows?.map((r) => (
              <tr key={r.id} onClick={() => navigate(`/admin/applications/${r.id}`)}>
                <td style={{ fontWeight: 700, color: 'var(--blue-800)' }}>{r.membership_id || r.reference_no}</td>
                <td>{r.name}</td>
                <td>{r.place}</td>
                <td>{r.membership_type === 'lifetime' ? 'Lifetime ₹2,000' : 'Two-Year ₹300'}</td>
                <td>{r.is_expat ? 'Yes' : 'No'}</td>
                <td style={{ fontFamily: 'monospace' }}>{r.aadhaar_number}</td>
                <td>{statusPill(r.status)}</td>
                <td>{r.payment_status === 'Paid' ? <span className="pill green">Paid</span> : <span className="pill grey">Unpaid</span>}</td>
                <td>{new Date(r.created_at).toLocaleDateString('en-IN')}</td>
                {renderActions && (
                  <td onClick={(e) => e.stopPropagation()} style={{ cursor: 'default' }}>
                    {renderActions(r)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows && rows.length === 0 && <div className="empty-note">{emptyText}</div>}
      {!rows && <div className="empty-note"><span className="spinner lg" /></div>}
    </div>
  );
}

/** Small "⋮" dropdown used in the top-right corner of a member card. items: [{icon,label,onClick,danger}] */
export function CardMenu({ items }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  if (!items?.length) return null;

  return (
    <div className="card-menu" ref={ref} onClick={(e) => e.stopPropagation()}>
      <button type="button" className="card-menu-btn" onClick={() => setOpen((o) => !o)} aria-label="Actions">⋮</button>
      {open && (
        <div className="card-menu-pop">
          {items.map((it, i) => (
            <button
              type="button" key={i}
              className={`card-menu-item ${it.danger ? 'danger' : ''}`}
              onClick={() => { setOpen(false); it.onClick(); }}
            >
              <span className="mi-ico">{it.icon}</span>{it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const planLabel = (r) => (r.membership_type === 'lifetime' ? 'Lifetime' : 'Two-Year');

/**
 * Vertical member card grid. `photoUrls` maps application id -> object URL (fetched by the
 * caller so this component stays fetch-free). `menuItems(row)` returns CardMenu items, or
 * omit for a plain read-only grid.
 */
export function MemberGrid({ rows, size = 'default', photoUrls, menuItems, emptyText = 'No members found.' }) {
  const navigate = useNavigate();
  if (!rows) return <div className="empty-note"><span className="spinner lg" /></div>;
  if (rows.length === 0) return <div className="empty-note">{emptyText}</div>;

  return (
    <div className={`member-grid ${size === 'compact' ? 'compact' : ''}`}>
      {rows.map((r) => (
        <div key={r.id} className="member-card" onClick={() => navigate(`/admin/applications/${r.id}`)}>
          <div className="mg-top">
            {menuItems && <CardMenu items={menuItems(r)} />}
          </div>
          <div className="mg-photo-wrap">
            {photoUrls?.[r.id]
              ? <img src={photoUrls[r.id]} alt={r.name} className="mg-photo" />
              : <div className="mg-photo placeholder">👤</div>}
          </div>
          <div className="mg-body">
            <div className="mg-name" title={r.name}>{r.name}</div>
            <div className="mg-id">{r.membership_id || r.reference_no}</div>
            <div className="mg-pills">
              {statusPill(r.status)}
              {r.payment_status === 'Paid' ? <span className="pill green">Paid</span> : <span className="pill grey">Unpaid</span>}
            </div>
            <div className="mg-meta">{r.place}{r.place ? ' · ' : ''}{planLabel(r)}{r.is_expat ? ' · Expat' : ''}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
