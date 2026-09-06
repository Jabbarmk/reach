import { WAYANAD_LOCAL_BODIES, QUALIFICATIONS, BLOOD_GROUPS, COUNTRIES } from './data/countries.js';
import { formatDate } from './dateUtils.js';

// Fallback used only if the API is unreachable, so the form still renders.
const FALLBACK = {
  plans: [
    { code: 'two_year', name: 'Two-Year Membership', fee: 300, validity_type: 'range', validity_start: '2027-01-01', validity_end: '2028-12-31' },
    { code: 'lifetime', name: 'Lifetime Membership', fee: 2000, validity_type: 'lifetime' },
  ],
  fields: [],
  options: {
    panchayath: WAYANAD_LOCAL_BODIES,
    qualification: QUALIFICATIONS,
    blood_group: BLOOD_GROUPS,
    country: COUNTRIES.map((c) => c.name),
  },
};

export function buildConfig(raw) {
  const src = raw || FALLBACK;
  const map = Object.fromEntries((src.fields || []).map((f) => [f.field_key, f]));
  return {
    registration: src.registration || { open: true },
    declarations: src.declarations || [],
    plans: src.plans || [],
    options: src.options || {},
    map,
    label: (key, fallback) => map[key]?.label ?? fallback,
    req: (key, fallback = true) => (map[key] ? Boolean(map[key].required && map[key].visible) : fallback),
    vis: (key) => (map[key] ? Boolean(map[key].visible) : true),
    customFor: (step) => (src.fields || []).filter((f) => !f.is_core && f.visible && f.step === step),
  };
}

export function planValidityText(plan) {
  if (!plan) return '';
  if (plan.validity_type === 'lifetime') return 'Valid for lifetime';
  const fmt = (d) => formatDate(d, { day: 'numeric', month: 'long', year: 'numeric' });
  return `Valid ${fmt(plan.validity_start)} – ${fmt(plan.validity_end)}`;
}
