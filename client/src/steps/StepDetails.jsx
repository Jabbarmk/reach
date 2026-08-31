import DocUpload from '../components/DocUpload.jsx';
import PhoneInput from '../components/PhoneInput.jsx';
import CustomFields from '../components/CustomFields.jsx';
import { TextField, SearchableSelect } from '../components/Field.jsx';
import { extractIdNumber } from '../ocr.js';

export default function StepDetails({ data, setField, errors, cfg }) {
  const isExpat = data.is_expat === true;
  const primaryPhone = isExpat ? data.phone_abroad : data.phone_india;
  const { label, req, vis } = cfg;

  const onSameAs = (checked) => {
    setField('whatsapp_same', checked);
    if (checked) setField('whatsapp', { ...primaryPhone });
  };

  const onIdExtract = async (file) => {
    const result = await extractIdNumber(file);
    if (result.number) {
      setField('id_card_number_abroad', result.number);
      setField('id_autofilled', true);
    }
    return result;
  };

  const currentYear = new Date().getFullYear();

  return (
    <div className="card">
      <h2>{isExpat ? 'Expat Details' : 'Retired / Returned Details'}</h2>
      <p className="sub">{isExpat ? 'Details about your life and work abroad.' : 'Details about your time abroad and current contact information.'}</p>

      {isExpat ? (
        <>
          <div className="grid2">
            {vis('phone_abroad') && (
              <PhoneInput
                label={label('phone_abroad', 'Phone Number (Abroad)')} required={req('phone_abroad')} value={data.phone_abroad}
                onChange={(v) => {
                  setField('phone_abroad', v);
                  if (data.whatsapp_same) setField('whatsapp', { ...v });
                }}
                error={errors.phone_abroad}
              />
            )}
            {vis('whatsapp_number') && (
              <PhoneInput
                label={label('whatsapp_number', 'WhatsApp Number')} required={req('whatsapp_number')} value={data.whatsapp}
                onChange={(v) => setField('whatsapp', v)}
                error={errors.whatsapp}
                sameAs onSameAs={onSameAs} sameAsChecked={data.whatsapp_same}
              />
            )}
          </div>
          {vis('email') && <TextField label={label('email', 'E-mail ID')} required={req('email')} type="email" value={data.email} onChange={(v) => setField('email', v)} error={errors.email} placeholder="name@example.com" />}

          {(vis('id_card_upload') || vis('id_card_number_abroad')) && <div className="section-title">Foreign ID Card</div>}
          {vis('id_card_upload') && (
            <DocUpload
              label={label('id_card_upload', 'ID Card Upload (Abroad)')}
              required={req('id_card_upload')}
              hint="Foreign residence ID, work permit or national ID — PDF, JPG or PNG. We will try to read the ID number automatically."
              doc={data.idCardDoc}
              onChange={(d) => setField('idCardDoc', d)}
              onExtract={onIdExtract}
              ocrState={data.idOcr}
              setOcrState={(s) => setField('idOcr', s)}
              error={errors.idCardDoc}
            />
          )}
          {vis('id_card_number_abroad') && (
            <TextField
              label={label('id_card_number_abroad', 'ID Card Number (Abroad)')} required={req('id_card_number_abroad')}
              value={data.id_card_number_abroad}
              onChange={(v) => { setField('id_card_number_abroad', v); setField('id_autofilled', false); }}
              error={errors.id_card_number_abroad}
              badge={data.id_autofilled ? 'Autofilled from ID card' : null}
              hint="This number is shown masked everywhere outside this form."
              uppercase
            />
          )}

          <div className="grid2">
            {vis('current_job') && <TextField label={label('current_job', 'Current Job')} required={req('current_job')} value={data.current_job} onChange={(v) => setField('current_job', v)} error={errors.current_job} uppercase />}
            {vis('working_country') && (
              <SearchableSelect
                label={label('working_country', 'Working Country')} required={req('working_country')}
                value={data.working_country} onChange={(v) => setField('working_country', v)}
                options={cfg.options.country || []} error={errors.working_country}
                placeholder="Search country…"
              />
            )}
            {vis('city') && <TextField label={label('city', 'City')} required={req('city')} value={data.city} onChange={(v) => setField('city', v)} error={errors.city} uppercase />}
            {vis('years_abroad') && (
              <TextField
                label={label('years_abroad', 'Total Years of Working in Abroad')} required={req('years_abroad')} type="number" min="0" step="1"
                value={data.years_abroad} onChange={(v) => setField('years_abroad', v.replace(/[^\d]/g, ''))} error={errors.years_abroad}
              />
            )}
          </div>
          <CustomFields step="expat" cfg={cfg} data={data} setField={setField} errors={errors} />
        </>
      ) : (
        <>
          <div className="grid2">
            {vis('retired_year') && (
              <TextField
                label={label('retired_year', 'Retired Year')} required={req('retired_year')} type="number" min="1900" max={currentYear}
                value={data.retired_year} onChange={(v) => setField('retired_year', v)} error={errors.retired_year}
                placeholder={`e.g. ${currentYear - 2}`}
              />
            )}
            {vis('phone_india') && (
              <PhoneInput
                label={label('phone_india', 'Phone Number (India)')} required={req('phone_india')} value={data.phone_india} lockDial
                onChange={(v) => {
                  setField('phone_india', v);
                  if (data.whatsapp_same) setField('whatsapp', { ...v });
                }}
                error={errors.phone_india}
              />
            )}
            {vis('whatsapp_number') && (
              <PhoneInput
                label={label('whatsapp_number', 'WhatsApp Number')} required={req('whatsapp_number')} value={data.whatsapp}
                onChange={(v) => setField('whatsapp', v)}
                error={errors.whatsapp}
                sameAs onSameAs={onSameAs} sameAsChecked={data.whatsapp_same}
              />
            )}
            {vis('email') && <TextField label={label('email', 'E-mail ID')} required={req('email')} type="email" value={data.email} onChange={(v) => setField('email', v)} error={errors.email} placeholder="name@example.com" />}
            {vis('current_job') && <TextField label={label('current_job', 'Current Job')} required={req('current_job')} value={data.current_job} onChange={(v) => setField('current_job', v)} error={errors.current_job} hint="e.g. Retired, Business, Consultant" uppercase />}
            {vis('years_abroad') && (
              <TextField
                label={label('years_abroad', 'Total Years Worked in Abroad')} required={req('years_abroad')} type="number" min="0" step="1"
                value={data.years_abroad} onChange={(v) => setField('years_abroad', v.replace(/[^\d]/g, ''))} error={errors.years_abroad}
              />
            )}
          </div>
          <CustomFields step="retired" cfg={cfg} data={data} setField={setField} errors={errors} />
        </>
      )}

      {(vis('emergency_name') || vis('emergency_phone')) && (
        <div className="section-title">Immediate Friend / Family Details</div>
      )}
      <div className="grid2">
        {vis('emergency_name') && <TextField label={label('emergency_name', 'Name')} required={req('emergency_name')} value={data.emergency_name} onChange={(v) => setField('emergency_name', v)} error={errors.emergency_name} uppercase />}
        {vis('emergency_phone') && (
          <PhoneInput
            label={label('emergency_phone', 'Phone Number')} required={req('emergency_phone')} value={data.emergency_phone}
            onChange={(v) => setField('emergency_phone', v)} error={errors.emergency_phone}
          />
        )}
        {isExpat && vis('home_contact_number') && (
          <PhoneInput
            label={label('home_contact_number', 'Home Contact Number')} required={req('home_contact_number')} value={data.home_contact_number} lockDial
            onChange={(v) => setField('home_contact_number', v)}
            error={errors.home_contact_number}
          />
        )}
      </div>
      <CustomFields step="details" cfg={cfg} data={data} setField={setField} errors={errors} />
    </div>
  );
}
