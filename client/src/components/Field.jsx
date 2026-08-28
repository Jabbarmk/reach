export function TextField({ label, required = true, value, onChange, error, type = 'text', badge, hint, ...rest }) {
  return (
    <div className={`field ${error ? 'invalid' : ''}`}>
      <label>
        {label} {required ? <span className="req">*</span> : <span className="opt">(optional)</span>}
        {badge && <span className="autofill-badge">✦ {badge}</span>}
      </label>
      <input type={type} value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...rest} />
      {hint && !error && <div className="hint">{hint}</div>}
      {error && <div className="err">{error}</div>}
    </div>
  );
}

export function SelectField({ label, required = true, value, onChange, options, error, placeholder = 'Select…' }) {
  return (
    <div className={`field ${error ? 'invalid' : ''}`}>
      <label>{label} {required && <span className="req">*</span>}</label>
      <select value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        <option value="" disabled>{placeholder}</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      {error && <div className="err">{error}</div>}
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';

export function SearchableSelect({ label, required = true, value, onChange, options, error, placeholder = 'Start typing to search…' }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef(null);

  useEffect(() => {
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const q = query.trim().toLowerCase();
  const filtered = q ? options.filter((o) => o.toLowerCase().includes(q)) : options;

  const pick = (opt) => {
    onChange(opt);
    setQuery('');
    setOpen(false);
  };

  return (
    <div className={`field ${error ? 'invalid' : ''}`} ref={wrapRef}>
      <label>{label} {required && <span className="req">*</span>}</label>
      <div className="ss-wrap">
        <input
          type="text"
          placeholder={value || placeholder}
          value={open ? query : value ?? ''}
          onFocus={() => { setOpen(true); setQuery(''); }}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && filtered.length === 1) { e.preventDefault(); pick(filtered[0]); }
            if (e.key === 'Escape') setOpen(false);
          }}
        />
        <span className="ss-caret">▾</span>
        {open && (
          <div className="ss-menu">
            {filtered.length === 0 && <div className="ss-empty">No match found</div>}
            {filtered.map((opt) => (
              <button
                type="button" key={opt}
                className={`ss-option ${opt === value ? 'selected' : ''}`}
                onMouseDown={(e) => { e.preventDefault(); pick(opt); }}
              >
                {opt}
              </button>
            ))}
          </div>
        )}
      </div>
      {error && <div className="err">{error}</div>}
    </div>
  );
}

export function SearchableCountry({ label, required = true, value, onChange, error }) {
  return (
    <div className={`field ${error ? 'invalid' : ''}`}>
      <label>{label} {required && <span className="req">*</span>}</label>
      <input
        type="text" list="country-list" placeholder="Start typing a country…"
        value={value ?? ''} onChange={(e) => onChange(e.target.value)}
      />
      {error && <div className="err">{error}</div>}
    </div>
  );
}
