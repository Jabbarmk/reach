// Countries shown in the homepage "Our Members Country" marquee, admin-editable
// from Settings. Flags are loaded client-side from flagcdn.com by ISO 3166-1 alpha-2 code.
export const MEMBER_COUNTRIES_DEFAULTS = {
  countries: [
    { code: 'ae', name: 'United Arab Emirates', members: 1240, visible: true, show_count: true },
    { code: 'sa', name: 'Saudi Arabia', members: 980, visible: true, show_count: true },
    { code: 'qa', name: 'Qatar', members: 640, visible: true, show_count: true },
    { code: 'kw', name: 'Kuwait', members: 410, visible: true, show_count: true },
    { code: 'om', name: 'Oman', members: 275, visible: true, show_count: true },
    { code: 'bh', name: 'Bahrain', members: 190, visible: true, show_count: true },
    { code: 'jo', name: 'Jordan', members: 65, visible: true, show_count: true },
    { code: 'iq', name: 'Iraq', members: 40, visible: true, show_count: true },
  ],
};

// The whole list is replaced on save (not merged item-by-item) — the admin UI always
// submits the full, current list.
export function mergeMemberCountries(stored) {
  if (!stored || !Array.isArray(stored.countries)) {
    return JSON.parse(JSON.stringify(MEMBER_COUNTRIES_DEFAULTS));
  }
  const countries = stored.countries
    .filter((c) => c && typeof c.code === 'string' && c.code.trim())
    .slice(0, 40)
    .map((c) => ({
      code: String(c.code).trim().toLowerCase().replace(/[^a-z]/g, '').slice(0, 2),
      name: String(c.name || '').slice(0, 80),
      members: Math.max(0, Math.min(999999, Math.round(Number(c.members)) || 0)),
      visible: c.visible !== false,
      show_count: c.show_count !== false,
    }))
    .filter((c) => c.code.length === 2);
  return { countries };
}
