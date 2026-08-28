export default function MembershipCard({ app, photoUrl }) {
  const validity = app.membership_type === 'lifetime'
    ? 'Lifetime'
    : `${app.validity_start || '2027-01-01'} → ${app.validity_end || '2028-12-31'}`;

  return (
    <div className="mcard print-zone">
      <div className="mc-top">
        <span className="mc-logo-chip">
          <img src="/api/logo" alt="REACH Pravasi Welfare Society" />
        </span>
        <p className="mc-cap">Official Membership Card</p>
      </div>
      <div className="mc-body">
        {photoUrl
          ? <img className="mc-photo" src={photoUrl} alt="Member" />
          : <div className="mc-photo" style={{ background: 'var(--blue-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30 }}>👤</div>}
        <div className="mc-info">
          <div className="nm">{app.name}</div>
          <div className="row"><span className="k">Member ID</span><span className="v">{app.membership_id || '—'}</span></div>
          <div className="row"><span className="k">Plan</span><span className="v">{app.membership_type === 'lifetime' ? 'Lifetime' : 'Two-Year'}</span></div>
          <div className="row"><span className="k">Validity</span><span className="v">{validity}</span></div>
          <div className="row"><span className="k">Blood Group</span><span className="v">{app.blood_group}</span></div>
          <div className="row"><span className="k">Place</span><span className="v">{app.place}</span></div>
        </div>
      </div>
      <div className="mc-foot">
        <span>www.reach.org</span>
        <span>{app.is_expat ? 'Expat Member' : 'Member'}</span>
      </div>
    </div>
  );
}
