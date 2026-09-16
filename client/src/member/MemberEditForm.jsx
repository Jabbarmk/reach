import { useEffect, useState } from 'react';
import { api } from '../api.js';
import PhotoUpload from '../components/PhotoUpload.jsx';

const PERSONAL_FIELDS = [
  { k: 'father_name', label: "Father's Name" },
  { k: 'house_name', label: 'House Name' },
  { k: 'place', label: 'Place' },
  { k: 'post_office', label: 'Post Office' },
];

const EXPAT_FIELDS = [
  { k: 'phone_abroad', label: 'Phone (Abroad)' },
  { k: 'home_contact_number', label: 'Home Contact Number' },
  { k: 'id_card_number_abroad', label: 'ID Number (Abroad)' },
];

const RETIRED_FIELDS = [
  { k: 'retired_year', label: 'Retired Year', type: 'number' },
  { k: 'phone_india', label: 'Phone (India)' },
];

const COMMON_FIELDS = [
  { k: 'whatsapp_number', label: 'WhatsApp' },
  { k: 'email', label: 'E-mail', type: 'email' },
  { k: 'current_job', label: 'Current Job' },
  { k: 'years_abroad', label: 'Years Abroad', type: 'number' },
  { k: 'emergency_name', label: 'Friend/Family Name' },
  { k: 'emergency_phone', label: 'Friend/Family Phone' },
];

const Field = ({ label, k, value, type = 'text', onChange }) => (
  <div className="field" style={{ marginBottom: 10 }}>
    <label>{label}</label>
    <input type={type} value={value ?? ''} onChange={(e) => onChange(k, e.target.value)} style={{ width: '100%' }} />
  </div>
);

export default function MemberEditForm({ app, onCancel, onSubmitted }) {
  const [form, setForm] = useState(() => {
    const initial = {};
    // aadhaar_number is excluded here: app.aadhaar_number is masked for display (see
    // GET /api/member/me), so pre-filling it would resubmit the masked string as the real
    // value. It gets its own blank-by-default field below instead.
    const keys = [
      'name', ...PERSONAL_FIELDS, 'panchayath', 'blood_group', 'date_of_birth', 'qualification',
      ...(app.is_expat ? EXPAT_FIELDS : RETIRED_FIELDS), ...(app.is_expat ? [{ k: 'working_country' }, { k: 'city' }] : []),
      ...COMMON_FIELDS,
    ].map((f) => (typeof f === 'string' ? f : f.k));
    for (const k of keys) initial[k] = app[k] ?? '';
    return initial;
  });
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [photo, setPhoto] = useState(null);
  const [options, setOptions] = useState({});
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const cfg = await api.formConfig();
        setOptions(cfg.options || {});
      } catch { /* dropdowns fall back to free text */ }
    })();
  }, []);

  const set = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!String(form.name || '').trim()) { setError('Name cannot be empty'); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      for (const [k, v] of Object.entries(form)) fd.append(k, v ?? '');
      if (aadhaarNumber.trim()) fd.append('aadhaar_number', aadhaarNumber.trim());
      if (photo?.file) fd.append('photo', photo.file);
      await api.memberSubmitEditRequest(fd);
      onSubmitted();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="card" style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: 16, marginBottom: 4 }}>Edit My Details</h2>
      <p className="hint" style={{ marginBottom: 12 }}>
        Changes are sent to the society office for approval and won't appear on your profile until approved.
      </p>
      {error && <div className="alert error" style={{ marginBottom: 12 }}>{error}</div>}

      <div style={{ marginBottom: 14 }}>
        <PhotoUpload photo={photo} onChange={setPhoto} required={false} label="Photo" />
      </div>

      <div className="grid2">
        <Field label="Name" k="name" value={form.name} onChange={set} />
        {PERSONAL_FIELDS.map((f) => <Field key={f.k} {...f} value={form[f.k]} onChange={set} />)}

        <div className="field">
          <label>Panchayath / Municipality</label>
          <select value={form.panchayath ?? ''} onChange={(e) => set('panchayath', e.target.value)}>
            <option value="">—</option>
            {(options.panchayath || []).map((o) => <option key={o}>{o}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Blood Group</label>
          <select value={form.blood_group ?? ''} onChange={(e) => set('blood_group', e.target.value)}>
            <option value="">—</option>
            {(options.blood_group || []).map((o) => <option key={o}>{o}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Qualification</label>
          <select value={form.qualification ?? ''} onChange={(e) => set('qualification', e.target.value)}>
            <option value="">—</option>
            {(options.qualification || []).map((o) => <option key={o}>{o}</option>)}
          </select>
        </div>
        <Field label="Date of Birth" k="date_of_birth" type="date" value={form.date_of_birth} onChange={set} />
        <div className="field" style={{ marginBottom: 10 }}>
          <label>ID Card Number</label>
          <input
            type="text" value={aadhaarNumber} placeholder={`On file: ${app.aadhaar_number || '—'}`}
            onChange={(e) => setAadhaarNumber(e.target.value)} style={{ width: '100%' }}
          />
          <div className="hint">Leave blank to keep your current ID card number.</div>
        </div>

        {app.is_expat ? (
          <>
            {EXPAT_FIELDS.map((f) => <Field key={f.k} {...f} value={form[f.k]} onChange={set} />)}
            <div className="field">
              <label>Working Country</label>
              <select value={form.working_country ?? ''} onChange={(e) => set('working_country', e.target.value)}>
                <option value="">—</option>
                {(options.country || []).map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>
            <Field label="City" k="city" value={form.city} onChange={set} />
          </>
        ) : (
          RETIRED_FIELDS.map((f) => <Field key={f.k} {...f} value={form[f.k]} onChange={set} />)
        )}

        {COMMON_FIELDS.map((f) => <Field key={f.k} {...f} value={form[f.k]} onChange={set} />)}
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
        <button type="button" className="btn btn-outline btn-sm" onClick={onCancel} disabled={busy}>Cancel</button>
        <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
          {busy ? 'Submitting…' : 'Submit for Approval'}
        </button>
      </div>
    </form>
  );
}
