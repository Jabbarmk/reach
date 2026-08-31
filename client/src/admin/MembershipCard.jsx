const fmtDate = (d) => {
  if (!d) return '—';
  const [y, m, dd] = d.split('-');
  return `${dd}/${m}/${y}`;
};

export default function MembershipCard({ app, photoUrl }) {
  const isLifetime = app.membership_type === 'lifetime';
  const issued = fmtDate(app.validity_start);
  const validTill = isLifetime ? 'Lifetime' : fmtDate(app.validity_end);

  return (
    <div className="mcard-v print-zone">
      <div className="mcv-header">
        <span className="mcv-badge">
          <img src="/api/logo" alt="REACH Pravasi Welfare Society" />
        </span>
        <p className="mcv-subtitle">Membership Card</p>
      </div>

      <div className="mcv-photo-wrap">
        {photoUrl
          ? <img className="mcv-photo" src={photoUrl} alt={app.name} />
          : <div className="mcv-photo mcv-photo-placeholder">👤</div>}
      </div>

      <div className="mcv-body">
        <div className="mcv-name">{app.name}</div>
        <span className="mcv-plan">{isLifetime ? 'Lifetime Membership' : 'Two-Year Membership'}</span>

        <div className="mcv-details">
          <div className="mcv-field">
            <span className="mcv-label">Membership ID</span>
            <span className="mcv-value mcv-id">{app.membership_id || 'Pending'}</span>
          </div>
          <div className="mcv-row2">
            <div className="mcv-field">
              <span className="mcv-label">Issued</span>
              <span className="mcv-value">{issued}</span>
            </div>
            <div className="mcv-field" style={{ textAlign: 'right' }}>
              <span className="mcv-label">Valid Till</span>
              <span className="mcv-value">{validTill}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mcv-footer">REACH Pravasi Welfare Society</div>
    </div>
  );
}
