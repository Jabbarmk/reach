import { COUNTRIES } from '../data/countries.js';

/** value = { dial: '+91', number: '9876543210' } */
export default function PhoneInput({ label, required = true, value, onChange, error, lockDial = false, excludeDial = [], sameAs, onSameAs, sameAsChecked }) {
  const v = value || { dial: '+91', number: '' };
  const allowed = excludeDial.length ? COUNTRIES.filter((c) => !excludeDial.includes(c.dial)) : COUNTRIES;
  // India (+91) is pinned first so it's always one tap away, e.g. for an Expat's family back home.
  const options = [...allowed.filter((c) => c.dial === '+91'), ...allowed.filter((c) => c.dial !== '+91')];
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
          {options.map((c) => (
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
