import PhotoUpload from '../components/PhotoUpload.jsx';
import DocUpload from '../components/DocUpload.jsx';
import CustomFields from '../components/CustomFields.jsx';
import { TextField, SelectField, SearchableSelect } from '../components/Field.jsx';
import { extractAadhaar } from '../ocr.js';

const formatAadhaar = (digits) => digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim();

export default function StepPersonal({ data, setField, errors, cfg }) {
  const today = new Date().toISOString().slice(0, 10);
  const { label, req, vis } = cfg;

  const onAadhaarExtract = async (file) => {
    const result = await extractAadhaar(file);
    if (result.name && !data.name) {
      setField('name', result.name);
      setField('name_autofilled', true);
    }
    if (result.number) {
      setField('aadhaar_number', result.number);
      setField('aadhaar_autofilled', true);
    }
    return result;
  };

  return (
    <div className="card">
      <h2>Personal Information</h2>
      <p className="sub">Fields marked <span style={{ color: 'var(--red-600)' }}>*</span> are required.</p>

      {vis('photo') && (
        <PhotoUpload
          photo={data.photo}
          onChange={(p) => setField('photo', p)}
          error={errors.photo}
          label={label('photo', 'Photo')}
          required={req('photo')}
        />
      )}

      {vis('name') && (
        <TextField
          label={label('name', 'Name')} required={req('name')} value={data.name}
          onChange={(v) => { setField('name', v); setField('name_autofilled', false); }}
          error={errors.name}
          badge={data.name_autofilled ? 'Autofilled from Aadhaar' : null}
          placeholder="Full name as on Aadhaar"
          uppercase
        />
      )}

      <div className="grid2">
        {vis('father_name') && <TextField label={label('father_name', "Father's Name")} required={req('father_name')} value={data.father_name} onChange={(v) => setField('father_name', v)} error={errors.father_name} uppercase />}
        {vis('house_name') && <TextField label={label('house_name', 'House Name')} required={req('house_name')} value={data.house_name} onChange={(v) => setField('house_name', v)} error={errors.house_name} uppercase />}
        {vis('place') && <TextField label={label('place', 'Place')} required={req('place')} value={data.place} onChange={(v) => setField('place', v)} error={errors.place} uppercase />}
        {vis('post_office') && <TextField label={label('post_office', 'Post Office')} required={req('post_office')} value={data.post_office} onChange={(v) => setField('post_office', v)} error={errors.post_office} uppercase />}
        {vis('panchayath') && (
          <SearchableSelect
            label={label('panchayath', 'Panchayath / Municipality')} required={req('panchayath')}
            value={data.panchayath}
            onChange={(v) => setField('panchayath', v)}
            options={cfg.options.panchayath || []}
            error={errors.panchayath}
            placeholder="Search panchayath / municipality…"
            uppercase
          />
        )}
        {vis('blood_group') && <SelectField label={label('blood_group', 'Blood Group')} required={req('blood_group')} value={data.blood_group} onChange={(v) => setField('blood_group', v)} options={cfg.options.blood_group || []} error={errors.blood_group} />}
        {vis('date_of_birth') && (
          <TextField
            label={label('date_of_birth', 'Date of Birth')} required={req('date_of_birth')} type="date" value={data.date_of_birth}
            onChange={(v) => setField('date_of_birth', v)} error={errors.date_of_birth} max={today}
          />
        )}
        {vis('qualification') && <SelectField label={label('qualification', 'Qualification')} required={req('qualification')} value={data.qualification} onChange={(v) => setField('qualification', v)} options={cfg.options.qualification || []} error={errors.qualification} uppercase />}
      </div>

      {(vis('aadhaar_upload') || vis('aadhaar_number')) && <div className="section-title">Aadhaar Card</div>}
      {vis('aadhaar_upload') && (
        <DocUpload
          label={label('aadhaar_upload', 'Aadhaar Card Upload')}
          required={req('aadhaar_upload')}
          hint="Upload your Aadhaar card (PDF, JPG or PNG). We will try to read your name and Aadhaar number automatically."
          doc={data.aadhaarDoc}
          onChange={(d) => setField('aadhaarDoc', d)}
          onExtract={onAadhaarExtract}
          ocrState={data.aadhaarOcr}
          setOcrState={(s) => setField('aadhaarOcr', s)}
          error={errors.aadhaarDoc}
        />
      )}
      {vis('aadhaar_number') && (
        <TextField
          label={label('aadhaar_number', 'Aadhaar Card Number')} required={req('aadhaar_number')}
          value={formatAadhaar(data.aadhaar_number || '')}
          onChange={(v) => { setField('aadhaar_number', v.replace(/\D/g, '').slice(0, 12)); setField('aadhaar_autofilled', false); }}
          error={errors.aadhaar_number}
          badge={data.aadhaar_autofilled ? 'Autofilled from Aadhaar' : null}
          placeholder="XXXX XXXX XXXX"
          inputMode="numeric"
          hint="12 digits. Your Aadhaar number is stored securely and shown masked everywhere else."
        />
      )}

      <CustomFields step="personal" cfg={cfg} data={data} setField={setField} errors={errors} />
    </div>
  );
}
