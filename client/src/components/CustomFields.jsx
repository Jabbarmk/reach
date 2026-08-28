import { TextField, SelectField } from './Field.jsx';

/** Renders admin-defined custom fields for a wizard step. Values live in data.custom[field_key]. */
export default function CustomFields({ step, cfg, data, setField, errors }) {
  const fields = cfg.customFor(step);
  if (!fields.length) return null;

  const setCustom = (key, value) => setField('custom', { ...data.custom, [key]: value });

  return (
    <>
      {fields.map((f) => {
        const value = data.custom?.[f.field_key] ?? '';
        const error = errors[`custom_${f.field_key}`];
        const required = Boolean(f.required);
        switch (f.field_type) {
          case 'select':
            return (
              <SelectField
                key={f.field_key} label={f.label} required={required} error={error}
                value={value} onChange={(v) => setCustom(f.field_key, v)}
                options={cfg.options[f.options_key] || []}
              />
            );
          case 'yesno':
            return (
              <SelectField
                key={f.field_key} label={f.label} required={required} error={error}
                value={value} onChange={(v) => setCustom(f.field_key, v)}
                options={['Yes', 'No']}
              />
            );
          case 'number':
            return (
              <TextField
                key={f.field_key} label={f.label} required={required} error={error} type="number"
                value={value} onChange={(v) => setCustom(f.field_key, v)}
              />
            );
          case 'date':
            return (
              <TextField
                key={f.field_key} label={f.label} required={required} error={error} type="date"
                value={value} onChange={(v) => setCustom(f.field_key, v)}
              />
            );
          default:
            return (
              <TextField
                key={f.field_key} label={f.label} required={required} error={error}
                value={value} onChange={(v) => setCustom(f.field_key, v)}
              />
            );
        }
      })}
    </>
  );
}
