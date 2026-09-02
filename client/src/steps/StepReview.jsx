const maskId = (n) => (n ? (n.length <= 4 ? 'X'.repeat(n.length) : 'X'.repeat(n.length - 4) + n.slice(-4)) : '—');
const phone = (p) => (p?.number ? `${p.dial} ${p.number}` : '—');

function Block({ title, onEdit, rows }) {
  return (
    <div className="review-block">
      <div className="rb-head">
        <h4>{title}</h4>
        <button type="button" onClick={onEdit}>Edit</button>
      </div>
      <div className="review-rows">
        {rows.map(([k, v]) => (
          <div className="review-row" key={k}>
            <div className="k">{k}</div>
            <div className="v">{v || '—'}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

import { planValidityText } from '../formConfig.js';

export default function StepReview({ data, goTo, cfg }) {
  const isExpat = data.is_expat === true;
  const plan = cfg.plans.find((p) => p.code === data.membership_type);
  const planName = plan?.name || data.membership_type;
  const planValidity = planValidityText(plan);
  const planFee = plan ? `₹${Number(plan.fee).toLocaleString('en-IN')}` : '—';
  const customRows = (steps) =>
    steps.flatMap((s) => cfg.customFor(s)).map((f) => [f.label, data.custom?.[f.field_key]]);

  const docStatus = (doc, requiredLabel) =>
    doc ? <span className="pill green">Uploaded</span> : <span className="pill grey">{requiredLabel || 'Not uploaded'}</span>;

  return (
    <div className="card">
      <h2>Review Your Application</h2>
      <p className="sub">Please check everything carefully. Use Edit to go back and change any section.</p>

      <Block
        title="Membership" onEdit={() => goTo(0)}
        rows={[['Plan', planName], ['Validity', planValidity], ['Fee', planFee]]}
      />

      <Block
        title="Personal Information" onEdit={() => goTo(1)}
        rows={[
          ['Photo', docStatus(data.photo)],
          ['Name', data.name],
          ["Father's Name", data.father_name],
          ['House Name', data.house_name],
          ['Place', data.place],
          ['Post Office', data.post_office],
          ['Panchayath/Municipality', data.panchayath],
          ['Blood Group', data.blood_group],
          ['Date of Birth', data.date_of_birth],
          ['ID Card Number', maskId(data.aadhaar_number)],
          ['ID Card', docStatus(data.aadhaarDoc)],
          ['Qualification', data.qualification],
          ...customRows(['personal']),
        ]}
      />

      <Block
        title="Expat Status" onEdit={() => goTo(2)}
        rows={[['Expat', isExpat ? <span className="pill blue">YES — Expat</span> : <span className="pill teal">NO — Retired / Returned</span>]]}
      />

      <Block
        title={isExpat ? 'Expat Details' : 'Retired / Returned Details'} onEdit={() => goTo(3)}
        rows={
          isExpat
            ? [
                ['Phone (Abroad)', phone(data.phone_abroad)],
                ['Home Contact Number', phone(data.home_contact_number)],
                ['WhatsApp', phone(data.whatsapp)],
                ['E-mail', data.email],
                ['Foreign ID Card', docStatus(data.idCardDoc)],
                ['ID Number (Abroad)', maskId(data.id_card_number_abroad)],
                ['Current Job', data.current_job],
                ['Working Country', data.working_country],
                ['City', data.city],
                ['Years Abroad', data.years_abroad],
                ['Friend/Family Name', data.emergency_name],
                ['Friend/Family Phone', phone(data.emergency_phone)],
                ...customRows(['expat', 'details']),
              ]
            : [
                ['Retired Year', data.retired_year],
                ['Phone (India)', phone(data.phone_india)],
                ['WhatsApp', phone(data.whatsapp)],
                ['E-mail', data.email],
                ['Current Job', data.current_job],
                ['Years Abroad', data.years_abroad],
                ['Friend/Family Name', data.emergency_name],
                ['Friend/Family Phone', phone(data.emergency_phone)],
                ...customRows(['retired', 'details']),
              ]
        }
      />
    </div>
  );
}
