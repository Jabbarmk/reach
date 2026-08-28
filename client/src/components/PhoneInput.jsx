import { COUNTRIES } from '../data/countries.js';

/** value = { dial: '+91', number: '9876543210' } */
export default function PhoneInput({ label, required = true, value, onChange, error, lockDial = false, sameAs, onSameAs, sameAsChecked }) {
  const v = value || { dial: '+91', number: '' };
  return (
    <div className={`field ${error ? 'invalid' : ''}`}>
      <label>{label} {required && <span className="req">*</span>}</label>
      <div className="phone-row">
        <select
          value={v.dial}
          disabled={lockDial}
          onChange={(e) => onChange({ ...v, dial: e.target.value })}
          aria-label="Country code"
        >
          {COUNTRIES.map((c) => (
            <option key={c.name} value={c.dial}>{c.dial} {c.name.length > 14 ? `${c.name.slice(0, 13)}…` : c.name}</option>
          ))}
        </select>
        <input
          type="tel"
          inputMode="numeric"
          placeholder="Phone number"
          value={v.number}
          disabled={sameAsChecked}
          onChange={(e) => onChange({ ...v, number: e.target.value.replace(/[^\d]/g, '').slice(0, 15) })}
        />
      </div>
      {sameAs && (
        <label className="checkline">
          <input type="checkbox" checked={!!sameAsChecked} onChange={(e) => onSameAs(e.target.checked)} />
          Same as phone number
        </label>
      )}
      {error && <div className="err">{error}</div>}
    </div>
  );
}
