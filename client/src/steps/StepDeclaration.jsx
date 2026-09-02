export default function StepDeclaration({ data, setField, error, cfg }) {
  const declarations = cfg.declarations || [];

  const toggle = (id, checked) => {
    setField('declaration_checks', { ...data.declaration_checks, [id]: checked });
  };

  return (
    <div className="card">
      <h2>സത്യപ്രസ്താവന (Declaration)</h2>
      <p className="sub">Please read and tick every point below before submitting your application.</p>

      {declarations.length > 0 && (
        <div className="declaration-box">
          {declarations.map((d, i) => (
            <label
              key={d.id} className="checkline"
              style={{ alignItems: 'flex-start', marginTop: i === 0 ? 0 : 14 }}
            >
              <input
                type="checkbox" style={{ marginTop: 3, flexShrink: 0 }}
                checked={!!data.declaration_checks?.[d.id]}
                onChange={(e) => toggle(d.id, e.target.checked)}
              />
              <span style={{ whiteSpace: 'pre-line', fontSize: 14, color: 'var(--ink)', lineHeight: 1.75 }}>{d.text}</span>
            </label>
          ))}
        </div>
      )}

      {error && <div className="err" style={{ marginTop: 6 }}>{error}</div>}
    </div>
  );
}
