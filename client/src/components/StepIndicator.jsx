const STEPS = ['Membership', 'Personal Info', 'Expat Status', 'Details', 'Review'];

export default function StepIndicator({ current }) {
  const pct = Math.min(100, Math.round((current / (STEPS.length - 1)) * 100));
  return (
    <div className="stepper">
      <div className="bar-track"><div className="bar-fill" style={{ width: `${pct}%` }} /></div>
      <div className="steps-row">
        {STEPS.map((label, i) => (
          <div key={label} className={`step-item ${i === current ? 'active' : ''} ${i < current ? 'done' : ''}`}>
            <div className="dot">{i < current ? '✓' : i + 1}</div>
            <div className="lbl">{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
