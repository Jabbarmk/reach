import { planValidityText } from '../formConfig.js';

const TAGS = ['teal', 'orange', 'blue', 'green'];

export default function StepMembership({ data, setField, error, cfg }) {
  return (
    <div className="card">
      <h2>Select Your Membership</h2>
      <p className="sub">Choose the membership plan you would like to apply for.</p>

      <div className="plan-grid" role="radiogroup" aria-label="Membership type">
        {cfg.plans.map((plan, i) => (
          <button
            key={plan.code}
            type="button"
            className={`plan-card ${data.membership_type === plan.code ? 'selected' : ''}`}
            onClick={() => setField('membership_type', plan.code)}
            role="radio" aria-checked={data.membership_type === plan.code}
          >
            <div className="radio" />
            <span className={`tag ${TAGS[i % TAGS.length]}`}>
              {plan.validity_type === 'lifetime' ? 'Lifetime' : 'Fixed Term'}
            </span>
            <h3>{plan.name}</h3>
            <div className="validity">{planValidityText(plan)}</div>
            <div className="fee">₹{Number(plan.fee).toLocaleString('en-IN')} <small>one-time</small></div>
          </button>
        ))}
      </div>

      {error && <div className="alert error" style={{ marginTop: 16 }}>{error}</div>}
    </div>
  );
}
