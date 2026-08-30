const EXPAT_FIELDS = ['phone_abroad', 'id_card_number_abroad', 'working_country', 'city', 'idCardDoc'];
const RETIRED_FIELDS = ['retired_year', 'phone_india'];
const SHARED = ['whatsapp', 'whatsapp_same', 'email', 'current_job', 'years_abroad', 'emergency_name', 'emergency_phone'];

export default function StepExpatStatus({ data, setField, error }) {
  const hasDetails = () => {
    const check = (keys) => keys.some((k) => {
      const v = data[k];
      if (v == null || v === '' || v === false) return false;
      if (typeof v === 'object' && 'number' in v) return Boolean(v.number);
      return true;
    });
    return check([...EXPAT_FIELDS, ...RETIRED_FIELDS, ...SHARED]);
  };

  const choose = (isExpat) => {
    if (data.is_expat !== null && data.is_expat !== isExpat && hasDetails()) {
      const ok = window.confirm(
        'Changing your Expat answer will clear the details you already entered in the next section. Continue?'
      );
      if (!ok) return;
      [...EXPAT_FIELDS, ...RETIRED_FIELDS, ...SHARED].forEach((k) => {
        if (k === 'phone_abroad' || k === 'whatsapp' || k === 'emergency_phone') setField(k, { dial: isExpat ? '+971' : '+91', number: '' });
        else if (k === 'phone_india') setField(k, { dial: '+91', number: '' });
        else if (k === 'whatsapp_same') setField(k, false);
        else setField(k, k === 'idCardDoc' ? null : '');
      });
      setField('idOcr', { status: 'idle' });
      setField('id_autofilled', false);
    }
    setField('is_expat', isExpat);
  };

  return (
    <div className="card">
      <h2>Are you currently an Expat?</h2>
      <p className="sub">This decides which details we ask for in the next step.</p>

      <div className="choice-grid" role="radiogroup" aria-label="Expat status">
        <button
          type="button"
          className={`choice-card ${data.is_expat === true ? 'selected' : ''}`}
          onClick={() => choose(true)} role="radio" aria-checked={data.is_expat === true}
        >
          <div className="emoji">✈️</div>
          <h3>Yes — I am an Expat</h3>
          <p>Currently living and working abroad</p>
        </button>
        <button
          type="button"
          className={`choice-card ${data.is_expat === false ? 'selected' : ''}`}
          onClick={() => choose(false)} role="radio" aria-checked={data.is_expat === false}
        >
          <div className="emoji">🏡</div>
          <h3>No — I have returned</h3>
          <p>Retired / returned and now living in India</p>
        </button>
      </div>

      {error && <div className="alert error" style={{ marginTop: 16 }}>{error}</div>}
    </div>
  );
}
