import { pool } from './db.js';
import { COUNTRY_CODES } from './data/countryCodes.js';

// Countries shown in the homepage "Our Members Country" marquee, admin-curated
// (visible/order) from Settings. Flags load client-side from flagcdn.com by ISO
// 3166-1 alpha-2 code. Member counts are never stored — they're always computed
// live from real applications (see attachLiveCounts below).
export const MEMBER_COUNTRIES_DEFAULTS = {
  countries: [
    { code: 'ae', name: 'United Arab Emirates', visible: true, show_count: true },
    { code: 'sa', name: 'Saudi Arabia', visible: true, show_count: true },
    { code: 'qa', name: 'Qatar', visible: true, show_count: true },
    { code: 'kw', name: 'Kuwait', visible: true, show_count: true },
    { code: 'om', name: 'Oman', visible: true, show_count: true },
    { code: 'bh', name: 'Bahrain', visible: true, show_count: true },
    { code: 'jo', name: 'Jordan', visible: true, show_count: true },
    { code: 'iq', name: 'Iraq', visible: true, show_count: true },
  ],
};

const codeForName = (name) => COUNTRY_CODES.find((c) => c.name.toLowerCase() === name.toLowerCase())?.code;

// The whole list is replaced on save (not merged item-by-item) — the admin UI always
// submits the full, current list. `members` is intentionally dropped even if a caller
// sends one (older admin UI, stale request) — counts only ever come from real data.
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
      visible: c.visible !== false,
      show_count: c.show_count !== false,
    }))
    .filter((c) => c.code.length === 2);
  return { countries };
}

// Real per-country member counts, from applications.working_country (any non-deleted
// application, regardless of status). Non-expat members have no working_country (it's
// their home country, not somewhere they registered as "working abroad"), so they're
// bucketed as 'India' — matching the dashboard's "Members by Country" widget convention.
async function realCountryCounts() {
  const [rows] = await pool.query(
    `SELECT COALESCE(NULLIF(working_country, ''), 'India') AS name, COUNT(*) AS count
     FROM applications WHERE deleted_at IS NULL GROUP BY name`
  );
  const map = new Map();
  for (const r of rows) map.set(r.name.toLowerCase(), { name: r.name, count: Number(r.count) });
  return map;
}

// Attaches a live `members` count to each curated country, and appends any country with
// real members that isn't in the curated list yet (visible by default, so new working-abroad
// countries show up on the homepage without extra admin setup).
export async function attachLiveCounts(merged) {
  const counts = await realCountryCounts();
  const seen = new Set(merged.countries.map((c) => c.name.toLowerCase()));
  const withCounts = merged.countries.map((c) => ({ ...c, members: counts.get(c.name.toLowerCase())?.count || 0, curated: true }));

  for (const [key, { name, count }] of counts) {
    if (seen.has(key)) continue;
    const code = codeForName(name);
    if (!code) continue; // no matching flag code — skip rather than show a broken flag
    // Not yet saved into the curated list — appears automatically because it has real
    // members. Removing it here won't stick (it'll just reappear); toggling Visible off
    // and saving is what actually persists hiding it.
    withCounts.push({ code, name, visible: true, show_count: true, members: count, curated: false });
  }
  return { countries: withCounts };
}
