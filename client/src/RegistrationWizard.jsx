import { useEffect, useState } from 'react';
import StepMembership from './steps/StepMembership.jsx';
import StepPersonal from './steps/StepPersonal.jsx';
import StepExpatStatus from './steps/StepExpatStatus.jsx';
import StepDetails from './steps/StepDetails.jsx';
import Confirmation from './steps/Confirmation.jsx';
import { api } from './api.js';
import { buildConfig } from './formConfig.js';

const initialData = {
  membership_type: '',
  photo: null,
  aadhaarDoc: null,
  aadhaarOcr: { status: 'idle' },
  name: '', name_autofilled: false,
  father_name: '', house_name: '', place: '', post_office: '', panchayath: '',
  blood_group: '', date_of_birth: '',
  aadhaar_number: '', aadhaar_autofilled: false,
  qualification: '',
  is_expat: null,
  phone_abroad: { dial: '+971', number: '' },
  home_contact_number: { dial: '+91', number: '' },
  idCardDoc: null,
  idOcr: { status: 'idle' },
  id_card_number_abroad: '', id_autofilled: false,
  working_country: '', city: '',
  retired_year: '',
  phone_india: { dial: '+91', number: '' },
  whatsapp: { dial: '+91', number: '' },
  whatsapp_same: false,
  email: '', current_job: '', years_abroad: '',
  emergency_name: '',
  emergency_phone: { dial: '+91', number: '' },
  custom: {},
  confirm_correct: false,
  consent: false,
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneOk = (p, min = 6) => p?.number && p.number.length >= min;

function validateCustom(cfg, step, d, e) {
  for (const f of cfg.customFor(step)) {
    if (!f.required) continue;
    const v = d.custom?.[f.field_key];
    if (v === undefined || v === null || String(v).trim() === '') {
      e[`custom_${f.field_key}`] = `${f.label} is required.`;
    }
  }
}

function validateStep(step, d, cfg) {
  const e = {};
  const { req, label } = cfg;
  const reqText = (key, value, fallback) => {
    if (req(key) && !String(value || '').trim()) e[key] = `${label(key, fallback).replace(/^\d+\.\s*/, '')} is required.`;
  };

  if (step === 0) {
    if (!cfg.plans.some((p) => p.code === d.membership_type)) e.membership_type = 'Please select a membership type to continue.';
  }
  if (step === 1) {
    if (req('photo') && !d.photo) e.photo = 'Photo is required.';
    if (req('aadhaar_upload') && !d.aadhaarDoc) e.aadhaarDoc = `${label('aadhaar_upload', 'Aadhaar card upload')} is required.`;
    reqText('name', d.name, 'Name');
    reqText('father_name', d.father_name, "Father's name");
    reqText('house_name', d.house_name, 'House name');
    reqText('place', d.place, 'Place');
    reqText('post_office', d.post_office, 'Post office');
    reqText('blood_group', d.blood_group, 'Blood group');
    reqText('qualification', d.qualification, 'Qualification');
    if (req('panchayath') && !d.panchayath.trim()) e.panchayath = 'Panchayath/Municipality is required.';
    else if (d.panchayath && (cfg.options.panchayath || []).length && !cfg.options.panchayath.includes(d.panchayath)) {
      e.panchayath = 'Please select a panchayath/municipality from the list.';
    }
    if (req('date_of_birth') && !d.date_of_birth) e.date_of_birth = 'Date of birth is required.';
    else if (d.date_of_birth && new Date(d.date_of_birth) > new Date()) e.date_of_birth = 'Date of birth cannot be in the future.';
    if (req('aadhaar_number') && !d.aadhaar_number) e.aadhaar_number = 'Aadhaar number is required.';
    else if (d.aadhaar_number && d.aadhaar_number.length !== 12) e.aadhaar_number = 'Aadhaar number must be exactly 12 digits.';
    validateCustom(cfg, 'personal', d, e);
  }
  if (step === 2) {
    if (d.is_expat === null) e.is_expat = 'Please choose YES or NO to continue.';
  }
  if (step === 3) {
    if (d.is_expat) {
      if (req('phone_abroad') && !phoneOk(d.phone_abroad)) e.phone_abroad = 'Phone number (abroad) is required.';
      if (req('home_contact_number') && !phoneOk(d.home_contact_number, 10)) e.home_contact_number = 'A valid 10-digit home contact number is required.';
      reqText('id_card_number_abroad', d.id_card_number_abroad, 'ID card number');
      if (req('id_card_upload') && !d.idCardDoc) e.idCardDoc = `${label('id_card_upload', 'ID card upload')} is required.`;
      reqText('working_country', d.working_country, 'Working country');
      reqText('city', d.city, 'City');
      validateCustom(cfg, 'expat', d, e);
    } else {
      const y = Number(d.retired_year);
      const now = new Date().getFullYear();
      if (req('retired_year') && !y) e.retired_year = 'Retired year is required.';
      else if (y && (y < 1900 || y > now)) e.retired_year = `Enter a year between 1900 and ${now}.`;
      if (req('phone_india') && !phoneOk(d.phone_india, 10)) e.phone_india = 'A valid 10-digit Indian phone number is required.';
      validateCustom(cfg, 'retired', d, e);
    }
    if (req('whatsapp_number') && !phoneOk(d.whatsapp)) e.whatsapp = 'WhatsApp number is required.';
    if (req('email') && !d.email) e.email = 'E-mail is required.';
    else if (d.email && !EMAIL_RE.test(d.email)) e.email = 'Enter a valid e-mail address.';
    reqText('current_job', d.current_job, 'Current job');
    if (req('years_abroad') && d.years_abroad === '') e.years_abroad = 'Enter 0 or more.';
    else if (d.years_abroad !== '' && Number(d.years_abroad) < 0) e.years_abroad = 'Enter 0 or more.';
    reqText('emergency_name', d.emergency_name, 'Name');
    if (req('emergency_phone') && !phoneOk(d.emergency_phone)) e.emergency_phone = 'Phone number is required.';
    validateCustom(cfg, 'details', d, e);
  }
  if (step === 4) {
    if (!d.confirm_correct || !d.consent) e.consent = 'Please tick both confirmations before submitting.';
  }
  return e;
}

export default function RegistrationWizard() {
  const [data, setData] = useState(initialData);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [result, setResult] = useState(null);
  const [cfg, setCfg] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        setCfg(buildConfig(await api.formConfig()));
      } catch {
        setCfg(buildConfig(null)); // offline fallback
      }
    })();
  }, []);

  const setField = (key, value) => setData((prev) => ({ ...prev, [key]: value }));

  if (!cfg) {
    return (
      <div className="page narrow">
        <div className="card" style={{ textAlign: 'center', padding: 60 }}>
          <span className="spinner lg" />
          <p className="sub" style={{ marginTop: 16, marginBottom: 0 }}>Loading registration form…</p>
        </div>
      </div>
    );
  }

  if (cfg.registration && cfg.registration.open === false) {
    return (
      <div className="page narrow">
        <div className="card closed-card">
          <div className="closed-ico">🔒</div>
          <h2>Registration Closed</h2>
          <p className="closed-msg">{cfg.registration.closed_message || 'New Membership Registration Temporarily Closed, Contact Admin'}</p>
        </div>
      </div>
    );
  }

  const submit = async () => {
    const e = {
      ...validateStep(0, data, cfg),
      ...validateStep(1, data, cfg),
      ...validateStep(2, data, cfg),
      ...validateStep(3, data, cfg),
      ...validateStep(4, data, cfg),
    };
    setErrors(e);
    if (Object.keys(e).length) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const fd = new FormData();
      fd.append('membership_type', data.membership_type);
      if (data.photo) fd.append('photo', data.photo.file);
      if (data.aadhaarDoc) {
        fd.append('aadhaar', data.aadhaarDoc.file);
        fd.append('aadhaar_ocr_status', ['success', 'failed', 'skipped'].includes(data.aadhaarOcr.status) ? data.aadhaarOcr.status : 'skipped');
      }
      fd.append('name', data.name);
      fd.append('father_name', data.father_name);
      fd.append('house_name', data.house_name);
      fd.append('place', data.place);
      fd.append('post_office', data.post_office);
      fd.append('panchayath', data.panchayath);
      fd.append('blood_group', data.blood_group);
      if (data.date_of_birth) fd.append('date_of_birth', data.date_of_birth);
      fd.append('aadhaar_number', data.aadhaar_number);
      fd.append('qualification', data.qualification);
      fd.append('is_expat', data.is_expat ? '1' : '0');

      const joinPhone = (p) => (p?.number ? `${p.dial} ${p.number}` : '');
      if (data.is_expat) {
        fd.append('phone_abroad', joinPhone(data.phone_abroad));
        fd.append('home_contact_number', joinPhone(data.home_contact_number));
        fd.append('id_card_number_abroad', data.id_card_number_abroad);
        fd.append('working_country', data.working_country);
        fd.append('city', data.city);
        if (data.idCardDoc) {
          fd.append('id_card', data.idCardDoc.file);
          fd.append('id_card_ocr_status', ['success', 'failed', 'skipped'].includes(data.idOcr.status) ? data.idOcr.status : 'skipped');
        }
      } else {
        if (data.retired_year) fd.append('retired_year', data.retired_year);
        fd.append('phone_india', joinPhone(data.phone_india));
      }
      fd.append('whatsapp_number', joinPhone(data.whatsapp));
      fd.append('email', data.email);
      fd.append('current_job', data.current_job);
      fd.append('years_abroad', data.years_abroad === '' ? '0' : data.years_abroad);
      fd.append('emergency_name', data.emergency_name);
      fd.append('emergency_phone', joinPhone(data.emergency_phone));
      fd.append('custom', JSON.stringify(data.custom || {}));
      fd.append('consent_accepted', '1');

      const res = await api.submitApplication(fd);
      setResult(res);
      window.scrollTo({ top: 0 });
    } catch (err) {
      setSubmitError(err.errors ? err.errors : [err.message]);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <div className="page narrow">
        <Confirmation result={result} data={data} />
      </div>
    );
  }

  const errorCount = Object.keys(errors).length;

  return (
    <div className="page narrow">
      <div className="reg-intro">
        <h1>Membership Registration</h1>
        <p>Complete every section below and submit — everything is on one page, no back-and-forth steps.</p>
      </div>

      {submitError && (
        <div className="alert error">
          <strong>Could not submit your application:</strong>
          <ul>{submitError.map((m, i) => <li key={i}>{m}</li>)}</ul>
        </div>
      )}
      {errorCount > 0 && (
        <div className="alert error">
          {errorCount} field{errorCount === 1 ? '' : 's'} need attention — they are highlighted below.
        </div>
      )}

      <div className="reg-sections">
        <StepMembership data={data} setField={setField} error={errors.membership_type} cfg={cfg} />
        <StepPersonal data={data} setField={setField} errors={errors} cfg={cfg} />
        <StepExpatStatus data={data} setField={setField} error={errors.is_expat} />
        {data.is_expat !== null && <StepDetails data={data} setField={setField} errors={errors} cfg={cfg} />}

        <div className="card">
          <h2>Confirm &amp; Submit</h2>
          <p className="sub">Please review the sections above, then confirm and submit your application.</p>

          <div className="declaration-box">
            <h3>സത്യപ്രസ്താവന</h3>
            <p>ഞാൻ REACH Pravasi Welfare Society-യുടെ നിയമാവലികൾ പൂർണ്ണമായി അംഗീകരിക്കുകയും അച്ചടക്കത്തോടെ പ്രവർത്തിക്കുമെന്ന് ഉറപ്പുനൽകുകയും ചെയ്യുന്നു;</p>
            <p>ഞാൻ നൽകിയ വിവരങ്ങൾ പൂര്‍ണമായും സത്യമാണെന്നും  തെറ്റായ വിവരങ്ങളോ സംഘടനാവിരുദ്ധ ലംഘനങ്ങളോ ക്രിമിനല്‍ കേസുകളോ തെളിഞ്ഞാൽ എന്റെ അംഗത്വം മുൻകൂട്ടി അറിയിപ്പില്ലാതെ റദ്ദാക്കാൻ സെൻട്രൽ കമ്മിറ്റിക്ക് പൂർണ്ണ അധികാരമുണ്ടായിരിക്കുന്നതാണെന്ന് ഞാന്‍ മനസ്സിലാക്കുകയും പൂര്‍ണ മനസ്സോടെ അംഗീകരിക്കുകയും ചെയ്യുന്നു.</p>
          </div>

          <label className="checkline" style={{ fontSize: 14, marginTop: 4 }}>
            <input
              type="checkbox" checked={data.confirm_correct}
              onChange={(e) => setField('confirm_correct', e.target.checked)}
            />
            I confirm the information supplied above is correct.
          </label>
          <label className="checkline" style={{ fontSize: 14 }}>
            <input
              type="checkbox" checked={data.consent}
              onChange={(e) => setField('consent', e.target.checked)}
            />
            I accept the membership terms and privacy policy, and consent to REACH processing my identity documents for membership verification.
          </label>
          {errors.consent && <div className="err" style={{ marginTop: 6 }}>{errors.consent}</div>}

          <button
            type="button" className="btn btn-green" style={{ marginTop: 20 }}
            onClick={submit} disabled={submitting}
          >
            {submitting ? 'Submitting…' : 'Submit Application ✓'}
          </button>
        </div>
      </div>
    </div>
  );
}
